import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BalanceOperationType, Prisma, RequestStatus, Role, User } from '@prisma/client';
import { EventBusService } from '../events/event-bus.service';
import { EmailNotificationService } from '../notifications/email-notification.service';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimeOffBatchDto } from './dto/create-timeoff-batch.dto';
import { CreateTimeOffRequestDto } from './dto/create-timeoff-request.dto';

const timeOffInclude = {
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
} satisfies Prisma.TimeOffRequestInclude;

@Injectable()
export class TimeOffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly emailNotification: EmailNotificationService,
  ) {}

  async create(currentUser: User, dto: CreateTimeOffRequestDto) {
    const request = await this.prisma.$transaction(async (tx) => {
      const request = await tx.timeOffRequest.create({
        data: {
          userId: currentUser.id,
          date: new Date(dto.date),
          hours: dto.hours,
          reason: dto.reason,
          comment: dto.comment,
          status: RequestStatus.PENDING,
        },
        include: timeOffInclude,
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
            title: 'Новая заявка на отгул',
            message: `${currentUser.fullName} запросил ${dto.hours} ч`,
            type: NotificationType.REQUEST_CREATED,
          })),
        });
      }

      return request;
    });

    this.eventBus.emit('leave-request.created', {
      requestId: request.id,
      userId:    currentUser.id,
      teamId:    currentUser.teamId ?? null,
      type:      'TIMEOFF_CREATED',
      message:   `${currentUser.fullName} создал заявку на отгул`,
    });

    return request;
  }

  getMyRequests(userId: string, params: {
    status?: string;
    kind?: 'timeoff' | 'vacation';
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  } = {}) {
    const { status, from, to, limit = 20, cursor } = params;

    return this.prisma.timeOffRequest.findMany({
      where: {
        userId,
        ...(status && status !== 'ALL' ? { status: status as RequestStatus } : {}),
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to   ? { lte: new Date(to)   } : {}),
          },
        } : {}),
      },
      include: timeOffInclude,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  getPending(currentUser: User) {
    return this.prisma.timeOffRequest.findMany({
      where: {
        status: RequestStatus.PENDING,
        ...this.buildApprovalVisibilityWhere(currentUser),
      },
      include: timeOffInclude,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async createBatch(currentUser: User, dto: CreateTimeOffBatchDto) {
    const totalHours = dto.hours * dto.dates.length;
    const balance = await this.prisma.timeBalance.findUnique({ where: { userId: currentUser.id } });
    if (!balance || balance.balanceHours < totalHours) {
      throw new BadRequestException(`Недостаточно баланса: нужно ${totalHours} ч, доступно ${balance?.balanceHours ?? 0} ч`);
    }

    return this.prisma.$transaction(
      dto.dates.map(date =>
        this.prisma.timeOffRequest.create({
          data: {
            userId: currentUser.id,
            date: new Date(date),
            hours: dto.hours,
            reason: dto.reason,
            comment: dto.comment,
            status: 'PENDING',
          },
        })
      )
    );
  }

  async approve(currentUser: User, id: string) {
    const request = await this.getPendingRequestForReview(currentUser, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const balance = await tx.timeBalance.upsert({
        where: { userId: request.userId },
        create: { userId: request.userId },
        update: {},
      });

      if (balance.balanceHours < request.hours) {
        throw new BadRequestException('Insufficient balance hours');
      }

      await tx.timeBalance.update({
        where: { userId: request.userId },
        data: {
          balanceHours: { decrement: request.hours },
          totalUsedHours: { increment: request.hours },
        },
      });

      await tx.balanceOperation.create({
        data: {
          userId: request.userId,
          operationType: BalanceOperationType.WRITE_OFF,
          hours: -request.hours,
          reason: `Approved time off request ${request.id}`,
          createdById: currentUser.id,
        },
      });

      return await tx.timeOffRequest.update({
        where: { id },
        data: {
          status: RequestStatus.APPROVED,
          approverId: currentUser.id,
          approvedAt: new Date(),
        },
        include: timeOffInclude,
      });
    });

    await this.prisma.notification.create({
      data: {
        userId: request.userId,
        title: 'Отгул согласован',
        message: `${request.hours} ч списаны с баланса`,
        type: NotificationType.REQUEST_APPROVED,
      },
    });

    this.eventBus.emit('leave-request.approved', {
      requestId: id,
      userId: updated.userId,
      teamId: updated.user?.teamId ?? null,
      type: 'TIMEOFF_APPROVED',
      message: 'Ваш отгул одобрен',
    });

    this.prisma.user.findUnique({ where: { id: request.userId }, select: { email: true, fullName: true } }).then(user => {
      if (user?.email) {
        this.emailNotification.sendRequestApproved(user.email, user.fullName, 'отгул', request.date.toISOString().slice(0, 10));
      }
    });

    return updated;
  }

  async reject(currentUser: User, id: string, approverComment?: string) {
    await this.getPendingRequestForReview(currentUser, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      return await tx.timeOffRequest.update({
        where: { id },
        data: {
          status: RequestStatus.REJECTED,
          approverId: currentUser.id,
          approverComment,
        },
        include: timeOffInclude,
      });
    });

    await this.prisma.notification.create({
      data: {
        userId: updated.userId,
        title: 'Отгул отклонён',
        message: approverComment || 'Заявка на отгул была отклонена',
        type: NotificationType.REQUEST_REJECTED,
      },
    });

    this.eventBus.emit('leave-request.rejected', {
      requestId: id,
      userId: updated.userId,
      teamId: null,
      type: 'TIMEOFF_REJECTED',
      message: 'Ваш отгул отклонён',
      approverComment,
    });

    this.prisma.user.findUnique({ where: { id: updated.userId }, select: { email: true, fullName: true } }).then(user => {
      if (user?.email) {
        this.emailNotification.sendRequestRejected(user.email, user.fullName, 'отгул', (updated as any).date?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10), approverComment);
      }
    });

    return updated;
  }

  async update(userId: string, id: string, dto: { date?: string; hours?: number; reason?: string; comment?: string }) {
    const request = await this.prisma.timeOffRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    if (request.userId !== userId) throw new ForbiddenException();
    if (request.status !== 'PENDING') throw new BadRequestException('Можно редактировать только pending-заявки');

    return this.prisma.timeOffRequest.update({
      where: { id },
      data: {
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.hours && { hours: dto.hours }),
        ...(dto.reason && { reason: dto.reason }),
        ...(dto.comment !== undefined && { comment: dto.comment }),
      },
    });
  }

  async cancel(currentUser: User, id: string) {
    const request = await this.prisma.timeOffRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Time off request not found');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be cancelled');
    }
    if (!this.canCancel(currentUser, request)) {
      throw new ForbiddenException('You cannot cancel this request');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timeOffRequest.update({
        where: { id },
        data: { status: RequestStatus.CANCELLED },
        include: timeOffInclude,
      });

      await tx.notification.create({
        data: {
          userId: request.userId,
          title: 'Отгул отменён',
          message: 'Заявка на отгул была отменена',
          type: NotificationType.REQUEST_REJECTED,
        },
      });

      return updated;
    });
  }

  private async getPendingRequestForReview(currentUser: User, id: string) {
    const request = await this.prisma.timeOffRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Time off request not found');
    }
    if (request.status !== RequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be reviewed');
    }
    if (!this.canReview(currentUser, request.user)) {
      throw new ForbiddenException('You cannot review this request');
    }

    return request;
  }

  private buildApprovalVisibilityWhere(currentUser: User): Prisma.TimeOffRequestWhereInput {
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
}
