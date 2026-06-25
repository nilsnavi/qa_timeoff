import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RequestStatus, Role, User } from '@prisma/client';
import { EventBusService } from '../events/event-bus.service';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVacationRequestDto } from './dto/create-vacation-request.dto';

const vacationInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      teamId: true,
    },
  },
  approver: {
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
    },
  },
} satisfies Prisma.VacationRequestInclude;

@Injectable()
export class VacationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(currentUser: User, dto: CreateVacationRequestDto) {
    const startDate = this.parseDate(dto.startDate);
    const endDate = this.parseDate(dto.endDate);
    const daysCount = this.calculateDaysCount(startDate, endDate);

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.vacationRequest.create({
        data: {
          userId: currentUser.id,
          startDate,
          endDate,
          daysCount,
          vacationType: dto.vacationType,
          comment: dto.comment,
          status: RequestStatus.PENDING,
        },
        include: vacationInclude,
      });

      const reviewers = await tx.user.findMany({
        where: {
          role: { in: [Role.LEAD, Role.MANAGER, Role.ADMIN] },
          ...(currentUser.teamId ? { OR: [{ teamId: currentUser.teamId }, { role: { in: [Role.MANAGER, Role.ADMIN] } }] } : {}),
          id: { not: currentUser.id },
        },
        select: { id: true },
      });

      if (reviewers.length > 0) {
        await tx.notification.createMany({
          data: reviewers.map((reviewer) => ({
            userId: reviewer.id,
            title: 'Новая заявка на отпуск',
            message: `${currentUser.fullName} запросил ${daysCount} дн.`,
            type: NotificationType.REQUEST_CREATED,
          })),
        });
      }

      return request;
    });
  }

  getMyRequests(userId: string) {
    return this.prisma.vacationRequest.findMany({
      where: { userId },
      include: vacationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  getPending(currentUser: User) {
    return this.prisma.vacationRequest.findMany({
      where: {
        status: RequestStatus.PENDING,
        ...this.buildApprovalVisibilityWhere(currentUser),
      },
      include: vacationInclude,
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async approve(currentUser: User, id: string) {
    await this.getPendingRequestForReview(currentUser, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      return await tx.vacationRequest.update({
        where: { id },
        data: {
          status: RequestStatus.APPROVED,
          approverId: currentUser.id,
          approvedAt: new Date(),
        },
        include: vacationInclude,
      });
    });

    await this.prisma.notification.create({
      data: {
        userId: updated.userId,
        title: 'Отпуск согласован',
        message: `Отпуск с ${this.formatDate(updated.startDate)} по ${this.formatDate(updated.endDate)} согласован`,
        type: NotificationType.REQUEST_APPROVED,
      },
    });

    this.eventBus.emit('leave-request.approved', {
      requestId: id,
      userId: updated.userId,
      teamId: updated.user?.teamId ?? null,
      type: 'VACATION_APPROVED',
      message: 'Ваш отпуск одобрен',
    });

    return updated;
  }

  async reject(currentUser: User, id: string, approverComment?: string) {
    await this.getPendingRequestForReview(currentUser, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      return await tx.vacationRequest.update({
        where: { id },
        data: {
          status: RequestStatus.REJECTED,
          approverId: currentUser.id,
          approverComment,
        },
        include: vacationInclude,
      });
    });

    await this.prisma.notification.create({
      data: {
        userId: updated.userId,
        title: 'Отпуск отклонён',
        message: approverComment || 'Заявка на отпуск была отклонена',
        type: NotificationType.REQUEST_REJECTED,
      },
    });

    this.eventBus.emit('leave-request.rejected', {
      requestId: id,
      userId: updated.userId,
      teamId: null,
      type: 'VACATION_REJECTED',
      message: 'Ваш отпуск отклонён',
      approverComment,
    });

    return updated;
  }

  async cancel(currentUser: User, id: string) {
    const request = await this.prisma.vacationRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Vacation request not found');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending vacation requests can be cancelled');
    }
    if (!this.canCancel(currentUser, request)) {
      throw new ForbiddenException('You cannot cancel this request');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vacationRequest.update({
        where: { id },
        data: { status: RequestStatus.CANCELLED },
        include: vacationInclude,
      });

      await tx.notification.create({
        data: {
          userId: request.userId,
          title: 'Отпуск отменён',
          message: 'Заявка на отпуск была отменена',
          type: NotificationType.REQUEST_REJECTED,
        },
      });

      return updated;
    });
  }

  private async getPendingRequestForReview(currentUser: User, id: string) {
    const request = await this.prisma.vacationRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Vacation request not found');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending vacation requests can be reviewed');
    }
    if (!this.canReview(currentUser, request.user)) {
      throw new ForbiddenException('You cannot review this request');
    }

    return request;
  }

  private parseDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }

    return date;
  }

  private calculateDaysCount(startDate: Date, endDate: Date) {
    if (endDate < startDate) {
      throw new BadRequestException('End date must be after or equal to start date');
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const startUtc = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
    const endUtc = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());

    return Math.floor((endUtc - startUtc) / msPerDay) + 1;
  }

  private buildApprovalVisibilityWhere(currentUser: User): Prisma.VacationRequestWhereInput {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return {};
    }

    if (currentUser.role === Role.LEAD) {
      return currentUser.teamId ? { user: { teamId: currentUser.teamId } } : { userId: currentUser.id };
    }

    return { userId: currentUser.id };
  }

  private canReview(currentUser: User, requestUser: { id: string; teamId: string | null }) {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return true;
    }

    if (currentUser.role === Role.LEAD) {
      return !!currentUser.teamId && currentUser.teamId === requestUser.teamId;
    }

    return false;
  }

  private canCancel(currentUser: User, request: { userId: string; user: { teamId: string | null } }) {
    if (currentUser.id === request.userId) {
      return true;
    }

    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return true;
    }

    return currentUser.role === Role.LEAD && !!currentUser.teamId && currentUser.teamId === request.user.teamId;
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
