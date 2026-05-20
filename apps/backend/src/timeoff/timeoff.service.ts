import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BalanceOperationType, Prisma, RequestStatus, Role, User } from '@prisma/client';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

  async create(currentUser: User, dto: CreateTimeOffRequestDto) {
    return this.prisma.$transaction(async (tx) => {
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
            title: 'New time off request',
            message: `${currentUser.fullName} requested ${dto.hours} hours off`,
            type: NotificationType.REQUEST_CREATED,
          })),
        });
      }

      return request;
    });
  }

  getMyRequests(userId: string) {
    return this.prisma.timeOffRequest.findMany({
      where: { userId },
      include: timeOffInclude,
      orderBy: { createdAt: 'desc' },
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

  async approve(currentUser: User, id: string) {
    const request = await this.getPendingRequestForReview(currentUser, id);

    return this.prisma.$transaction(async (tx) => {
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

      const updated = await tx.timeOffRequest.update({
        where: { id },
        data: {
          status: RequestStatus.APPROVED,
          approverId: currentUser.id,
          approvedAt: new Date(),
        },
        include: timeOffInclude,
      });

      await tx.notification.create({
        data: {
          userId: request.userId,
          title: 'Time off approved',
          message: `${request.hours} hours were approved and written off`,
          type: NotificationType.REQUEST_APPROVED,
        },
      });

      return updated;
    });
  }

  async reject(currentUser: User, id: string, approverComment?: string) {
    await this.getPendingRequestForReview(currentUser, id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.timeOffRequest.update({
        where: { id },
        data: {
          status: RequestStatus.REJECTED,
          approverId: currentUser.id,
          approverComment,
          approvedAt: new Date(),
        },
        include: timeOffInclude,
      });

      await tx.notification.create({
        data: {
          userId: updated.userId,
          title: 'Time off rejected',
          message: approverComment || 'Your time off request was rejected',
          type: NotificationType.REQUEST_REJECTED,
        },
      });

      return updated;
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
          title: 'Time off cancelled',
          message: 'Time off request was cancelled',
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
