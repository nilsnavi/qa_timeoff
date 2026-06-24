import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BalanceOperationType, LeaveRequestType, Prisma, RequestStatus, Role, User } from '@prisma/client';
import { EventBusService, LeaveRequestEvents } from '../events';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';

const leaveRequestInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      teamId: true,
      team: { select: { id: true, name: true } },
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
} satisfies Prisma.LeaveRequestInclude;

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(currentUser: User, dto: CreateLeaveRequestDto) {
    if (dto.dateTo && new Date(dto.dateTo) < new Date(dto.dateFrom)) {
      throw new BadRequestException('Дата окончания не может быть раньше даты начала');
    }

    const dateFrom = new Date(dto.dateFrom);
    const dateTo = dto.dateTo ? new Date(dto.dateTo) : null;

    const request = await this.prisma.$transaction(async (tx) => {
      await this.validateBalance(tx, currentUser.id, dto.hours);
      await this.validateOverlapAll(tx, currentUser.id, dateFrom, dateTo);

      const created = await tx.leaveRequest.create({
        data: {
          userId: currentUser.id,
          teamId: currentUser.teamId,
          type: dto.type as LeaveRequestType,
          dateFrom,
          dateTo,
          hours: dto.hours,
          reason: dto.reason,
          comment: dto.comment,
          status: RequestStatus.PENDING,
        },
        include: leaveRequestInclude,
      });

      const reviewers = await tx.user.findMany({
        where: {
          role: { in: [Role.LEAD, Role.MANAGER, Role.ADMIN] },
          id: { not: currentUser.id },
          ...(currentUser.teamId
            ? { OR: [{ teamId: currentUser.teamId }, { role: { in: [Role.MANAGER, Role.ADMIN] } }] }
            : {}),
        },
        select: { id: true },
      });

      if (reviewers.length > 0) {
        await tx.notification.createMany({
          data: reviewers.map((reviewer) => ({
            userId: reviewer.id,
            title: 'Новая заявка на отсутствие',
            message: `${currentUser.fullName} запросил ${dto.hours} ч · ${this.getTypeLabel(dto.type)}`,
            type: NotificationType.REQUEST_CREATED,
          })),
        });
      }

      return created;
    });

    this.eventBus.emit(LeaveRequestEvents.CREATED, {
      requestId: request.id,
      userId: currentUser.id,
      teamId: currentUser.teamId,
      type: dto.type,
      hours: dto.hours,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
    });

    return request;
  }

  async findAll(currentUser: User, query: QueryLeaveRequestsDto) {
    const where = this.buildVisibilityWhere(currentUser, query);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: leaveRequestInclude,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(currentUser: User, id: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: leaveRequestInclude,
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (!this.canView(currentUser, request)) {
      throw new ForbiddenException('You cannot view this request');
    }

    return request;
  }

  async approve(currentUser: User, id: string) {
    await this.canReviewRequest(currentUser, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!request || request.status !== RequestStatus.PENDING) {
        throw new BadRequestException('Заявка не найдена или уже рассмотрена');
      }

      if (request.type === LeaveRequestType.TIME_OFF) {
        const result = await tx.timeBalance.updateMany({
          where: { userId: request.userId, balanceHours: { gte: request.hours } },
          data: {
            balanceHours: { decrement: request.hours },
            totalUsedHours: { increment: request.hours },
          },
        });

        if (result.count === 0) {
          throw new BadRequestException('Недостаточно часов на балансе');
        }

        await tx.balanceOperation.create({
          data: {
            userId: request.userId,
            operationType: BalanceOperationType.WRITE_OFF,
            hours: -request.hours,
            reason: `Согласованная заявка #${request.id}`,
            createdById: currentUser.id,
          },
        });
      }

      const approved = await tx.leaveRequest.update({
        where: { id, status: RequestStatus.PENDING },
        data: {
          status: RequestStatus.APPROVED,
          approverId: currentUser.id,
          approvedAt: new Date(),
        },
        include: leaveRequestInclude,
      });

      if (!approved) {
        throw new BadRequestException('Заявка уже рассмотрена');
      }

      await tx.notification.create({
        data: {
          userId: request.userId,
          title: 'Заявка согласована',
          message: request.type === LeaveRequestType.TIME_OFF
            ? `${request.hours} ч списаны с баланса`
            : 'Заявка на отпуск согласована',
          type: NotificationType.REQUEST_APPROVED,
        },
      });

      return approved;
    });

    this.eventBus.emit(LeaveRequestEvents.APPROVED, {
      requestId: id,
      userId: updated.userId,
      teamId: updated.teamId,
      approvedById: currentUser.id,
      hours: updated.hours,
    });

    return updated;
  }

  async reject(currentUser: User, id: string, approverComment?: string) {
    await this.canReviewRequest(currentUser, id);

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.leaveRequest.findUnique({
        where: { id },
        select: { status: true, userId: true, teamId: true, hours: true },
      });

      if (!request || request.status !== RequestStatus.PENDING) {
        throw new BadRequestException('Заявка не найдена или уже рассмотрена');
      }

      const rejected = await tx.leaveRequest.update({
        where: { id, status: RequestStatus.PENDING },
        data: {
          status: RequestStatus.REJECTED,
          approverId: currentUser.id,
          approverComment,
        },
        include: leaveRequestInclude,
      });

      await tx.notification.create({
        data: {
          userId: rejected.userId,
          title: 'Заявка отклонена',
          message: approverComment || 'Ваша заявка была отклонена',
          type: NotificationType.REQUEST_REJECTED,
        },
      });

      return rejected;
    });

    this.eventBus.emit(LeaveRequestEvents.REJECTED, {
      requestId: id,
      userId: updated.userId,
      teamId: updated.teamId,
      rejectedById: currentUser.id,
      reason: approverComment,
    });

    return updated;
  }

  async getTeamSummary(currentUser: User) {
    if (currentUser.role === Role.EMPLOYEE) {
      return { pendingCount: 0 };
    }

    const where = this.buildTeamVisibilityWhere(currentUser);

    const [total, pendingCount] = await Promise.all([
      this.prisma.leaveRequest.count({ where }),
      this.prisma.leaveRequest.count({
        where: { ...where, status: RequestStatus.PENDING },
      }),
    ]);

    return { total, pendingCount };
  }

  private async validateBalance(tx: Prisma.TransactionClient, userId: string, hours: number) {
    const balance = await tx.timeBalance.findUnique({ where: { userId } });
    if (balance && balance.balanceHours < hours) {
      throw new BadRequestException('Недостаточно часов на балансе');
    }
  }

  private async validateOverlapAll(tx: Prisma.TransactionClient, userId: string, dateFrom: Date, dateTo: Date | null) {
    const effectiveTo = dateTo ?? dateFrom;

    const leaveOverlap = await tx.leaveRequest.findFirst({
      where: {
        userId,
        status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
        dateFrom: { lt: effectiveTo },
        OR: dateTo
          ? [{ dateTo: { gt: dateFrom } }, { dateTo: null }]
          : [{ dateTo: { gte: dateFrom } }, { dateTo: null }],
      },
      select: { id: true },
    });

    if (leaveOverlap) {
      throw new BadRequestException('Даты пересекаются с существующей заявкой');
    }

    const timeOffOverlap = await tx.timeOffRequest.findFirst({
      where: {
        userId,
        status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
        date: { gte: dateFrom, lte: effectiveTo },
      },
      select: { id: true },
    });

    if (timeOffOverlap) {
      throw new BadRequestException('Даты пересекаются с существующим отгулом');
    }

    const vacationOverlap = await tx.vacationRequest.findFirst({
      where: {
        userId,
        status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
        startDate: { lte: effectiveTo },
        endDate: { gte: dateFrom },
      },
      select: { id: true },
    });

    if (vacationOverlap) {
      throw new BadRequestException('Даты пересекаются с существующим отпуском');
    }
  }

  private buildVisibilityWhere(currentUser: User, query: QueryLeaveRequestsDto): Prisma.LeaveRequestWhereInput {
    const where: Prisma.LeaveRequestWhereInput = {};

    const isPrivileged = currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER;
    const isLead = currentUser.role === Role.LEAD;

    if (query.team_id && (isPrivileged || (isLead && currentUser.teamId === query.team_id))) {
      where.teamId = query.team_id;
    }

    if (query.user_id && (isPrivileged || (isLead && query.team_id === currentUser.teamId))) {
      where.userId = query.user_id;
    } else if (currentUser.role === Role.EMPLOYEE) {
      where.userId = currentUser.id;
    } else if (isLead) {
      where.OR = [{ userId: currentUser.id }, ...(currentUser.teamId ? [{ teamId: currentUser.teamId }] : [])];
    }

    if (query.status) {
      where.status = query.status as RequestStatus;
    }

    return where;
  }

  private buildTeamVisibilityWhere(currentUser: User): Prisma.LeaveRequestWhereInput {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return {};
    }

    if (currentUser.role === Role.LEAD && currentUser.teamId) {
      return { teamId: currentUser.teamId };
    }

    if (currentUser.role === Role.LEAD) {
      return { userId: currentUser.id };
    }

    return { userId: currentUser.id };
  }

  private canView(currentUser: User, request: { userId: string; teamId: string | null }) {
    if (currentUser.id === request.userId) return true;
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) return true;
    if (currentUser.role === Role.LEAD && currentUser.teamId && currentUser.teamId === request.teamId) return true;
    return false;
  }

  private async canReviewRequest(currentUser: User, id: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, teamId: true } } },
    });

    if (!request) {
      throw new NotFoundException('Заявка не найдена');
    }

    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) return;

    if (currentUser.role === Role.LEAD && currentUser.teamId && currentUser.teamId === request.user.teamId) return;

    throw new ForbiddenException('Вы не можете рассматривать эту заявку');
  }

  private getTypeLabel(type: string) {
    return type === 'TIME_OFF' ? 'Отгул' : 'Отпуск';
  }
}
