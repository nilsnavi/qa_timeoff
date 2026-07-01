import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LeaveRequestType, Prisma, RequestStatus, Role, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamRequestDto } from './dto/create-team-request.dto';
import { UpdateTeamRequestDto } from './dto/update-team-request.dto';

const teamRequestInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      role: true,
      position: true,
      teamId: true,
      isActive: true,
      lastLoginAt: true,
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
export class TeamRequestsService {
  private readonly logger = new Logger(TeamRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(currentUser: User, params: {
    teamId?: string;
    status?: string;
    type?: string;
    period?: string;
    employeeId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;

    const visibleStatuses: RequestStatus[] = this.getVisibleStatuses(currentUser);
    const teamFilter = this.getTeamFilter(currentUser, params.teamId);

    const where: Prisma.LeaveRequestWhereInput = {
      status: params.status
        ? { in: [params.status as RequestStatus] }
        : { in: visibleStatuses },
      teamId: teamFilter,
      ...(params.type ? { type: params.type as LeaveRequestType } : {}),
      ...(params.employeeId ? { userId: params.employeeId } : {}),
    };

    if (params.period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      where.dateFrom = { gte: today };
      where.dateTo = { lte: today };
    } else if (params.period === 'week') {
      const start = new Date();
      start.setDate(start.getDate() - start.getDay() + 1);
      start.setHours(0, 0, 0, 0);
      where.dateFrom = { gte: start };
    } else if (params.period === 'month') {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      where.dateFrom = { gte: start };
    } else if (params.period === 'expiring') {
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      where.dateTo = { lte: threeDaysFromNow };
      where.status = { in: [RequestStatus.APPROVED, RequestStatus.ACTIVE] };
    }

    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: teamRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async create(currentUser: User, dto: CreateTeamRequestDto) {
    const dateFrom = new Date(dto.dateFrom);
    const dateTo = dto.dateTo ? new Date(dto.dateTo) : null;
    const userId = dto.employeeId ?? currentUser.id;

    const request = await this.prisma.leaveRequest.create({
      data: {
        userId,
        teamId: currentUser.teamId,
        type: dto.type as LeaveRequestType,
        dateFrom,
        dateTo,
        hours: dto.hours,
        reason: dto.reason,
        comment: dto.comment,
        status: RequestStatus.DRAFT,
      },
      include: teamRequestInclude,
    });

    await this.audit.log({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'CREATE',
      entityType: 'LeaveRequest',
      entityId: request.id,
      entityName: `Заявка #${request.id.slice(0, 8)}`,
      newValue: request as any,
    });

    this.logger.log(`Team request created: ${request.id} by ${currentUser.fullName}`);
    return request;
  }

  async update(currentUser: User, id: string, dto: UpdateTeamRequestDto) {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Заявка не найдена');

    const isManager = [Role.LEAD, Role.MANAGER, Role.ADMIN].includes(currentUser.role as Role);
    if (existing.userId !== currentUser.id && !isManager) {
      throw new ForbiddenException('Недостаточно прав');
    }

    const data: Prisma.LeaveRequestUpdateInput = {};
    if (dto.type) data.type = dto.type as LeaveRequestType;
    if (dto.dateFrom) data.dateFrom = new Date(dto.dateFrom);
    if (dto.dateTo !== undefined) data.dateTo = dto.dateTo ? new Date(dto.dateTo) : null;
    if (dto.hours !== undefined) data.hours = dto.hours;
    if (dto.reason !== undefined) data.reason = dto.reason;
    if (dto.comment !== undefined) data.comment = dto.comment;

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data,
      include: teamRequestInclude,
    });

    await this.audit.log({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'UPDATE',
      entityType: 'LeaveRequest',
      entityId: id,
      entityName: `Заявка #${id.slice(0, 8)}`,
      oldValue: existing as any,
      newValue: updated as any,
    });

    return updated;
  }

  async remove(currentUser: User, id: string) {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Заявка не найдена');

    const isManager = [Role.LEAD, Role.MANAGER, Role.ADMIN].includes(currentUser.role as Role);
    if (existing.userId !== currentUser.id && !isManager) {
      throw new ForbiddenException('Недостаточно прав');
    }

    const deleted = await this.prisma.leaveRequest.delete({ where: { id } });

    await this.audit.log({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'DELETE',
      entityType: 'LeaveRequest',
      entityId: id,
      entityName: `Заявка #${id.slice(0, 8)}`,
      oldValue: existing as any,
    });

    return deleted;
  }

  async approve(currentUser: User, id: string, comment?: string) {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Заявка не найдена');

    const isManager = [Role.LEAD, Role.MANAGER, Role.ADMIN].includes(currentUser.role as Role);
    if (!isManager) throw new ForbiddenException('Только руководитель может согласовывать заявки');

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: RequestStatus.APPROVED,
        approverId: currentUser.id,
        approverComment: comment ?? null,
        approvedAt: new Date(),
      },
      include: teamRequestInclude,
    });

    await this.audit.log({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'APPROVE',
      entityType: 'LeaveRequest',
      entityId: id,
      entityName: `Заявка #${id.slice(0, 8)}`,
      oldValue: { status: existing.status } as any,
      newValue: { status: RequestStatus.APPROVED } as any,
    });

    return updated;
  }

  async reject(currentUser: User, id: string, comment?: string) {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Заявка не найдена');

    const isManager = [Role.LEAD, Role.MANAGER, Role.ADMIN].includes(currentUser.role as Role);
    if (!isManager) throw new ForbiddenException('Только руководитель может отклонять заявки');

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REJECTED,
        approverId: currentUser.id,
        approverComment: comment ?? null,
      },
      include: teamRequestInclude,
    });

    await this.audit.log({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'REJECT',
      entityType: 'LeaveRequest',
      entityId: id,
      entityName: `Заявка #${id.slice(0, 8)}`,
      oldValue: { status: existing.status } as any,
      newValue: { status: RequestStatus.REJECTED } as any,
    });

    return updated;
  }

  async reprocess(currentUser: User, id: string) {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Заявка не найдена');

    const reprocessed = await this.prisma.leaveRequest.create({
      data: {
        userId: existing.userId,
        teamId: existing.teamId,
        type: LeaveRequestType.OVERWORK,
        dateFrom: existing.dateFrom,
        dateTo: existing.dateTo,
        hours: existing.hours,
        reason: `Переработка: ${existing.reason}`,
        comment: existing.comment,
        status: RequestStatus.PENDING,
      },
      include: teamRequestInclude,
    });

    await this.audit.log({
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      actorRole: currentUser.role,
      action: 'REPROCESS',
      entityType: 'LeaveRequest',
      entityId: id,
      entityName: `Заявка #${id.slice(0, 8)}`,
      newValue: { reprocessedId: reprocessed.id } as any,
    });

    this.logger.log(`Request reprocessed: ${id} -> ${reprocessed.id}`);
    return reprocessed;
  }

  async getStats(currentUser: User, teamId?: string) {
    const teamFilter = this.getTeamFilter(currentUser, teamId);

    const [byType, byStatus, expiring, total, pending, approved, rejected] = await Promise.all([
      this.prisma.leaveRequest.groupBy({
        by: ['type'],
        where: { teamId: teamFilter },
        _count: true,
      }),
      this.prisma.leaveRequest.groupBy({
        by: ['status'],
        where: { teamId: teamFilter },
        _count: true,
      }),
      this.prisma.leaveRequest.count({
        where: {
          teamId: teamFilter,
          status: { in: [RequestStatus.APPROVED, RequestStatus.ACTIVE] },
          dateTo: { lte: new Date(Date.now() + 3 * 86400000) },
        },
      }),
      this.prisma.leaveRequest.count({ where: { teamId: teamFilter } }),
      this.prisma.leaveRequest.count({ where: { teamId: teamFilter, status: RequestStatus.PENDING } }),
      this.prisma.leaveRequest.count({ where: { teamId: teamFilter, status: RequestStatus.APPROVED } }),
      this.prisma.leaveRequest.count({ where: { teamId: teamFilter, status: RequestStatus.REJECTED } }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) {
      statusMap[s.status] = s._count;
    }

    return {
      byType: byType.map((t) => ({ type: t.type, count: t._count })),
      statusCounts: {
        total,
        pending: statusMap['PENDING'] ?? 0,
        approved: statusMap['APPROVED'] ?? 0,
        rejected: statusMap['REJECTED'] ?? 0,
        draft: statusMap['DRAFT'] ?? 0,
        active: statusMap['ACTIVE'] ?? 0,
        expired: statusMap['EXPIRED'] ?? 0,
        cancelled: statusMap['CANCELLED'] ?? 0,
      },
      expiring,
    };
  }

  async getTeamLoad(currentUser: User, teamId?: string) {
    const teamFilter = this.getTeamFilter(currentUser, teamId);

    const [approvedRequests, teamMembers] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where: {
          teamId: teamFilter,
          status: { in: [RequestStatus.APPROVED, RequestStatus.ACTIVE] },
          dateFrom: { lte: new Date(Date.now() + 30 * 86400000) },
          dateTo: { gte: new Date() },
        },
        select: { userId: true, hours: true, user: { select: { fullName: true } } },
      }),
      this.prisma.user.count({
        where: { teamId: teamFilter, isActive: true },
      }),
    ]);

    const byUser = new Map<string, { fullName: string; hours: number }>();
    for (const r of approvedRequests) {
      if (!byUser.has(r.userId)) {
        byUser.set(r.userId, { fullName: r.user.fullName, hours: 0 });
      }
      byUser.get(r.userId)!.hours += r.hours;
    }

    const totalLoadHours = Array.from(byUser.values()).reduce((sum, v) => sum + v.hours, 0);
    const maxCapacity = teamMembers * 160;

    return {
      teamMembers,
      totalLoadHours,
      maxCapacity,
      loadPercent: maxCapacity > 0 ? Math.round((totalLoadHours / maxCapacity) * 100) : 0,
      byUser: Array.from(byUser.entries()).map(([userId, v]) => ({ userId, ...v })),
    };
  }

  private getVisibleStatuses(user: User): RequestStatus[] {
    const isManager = [Role.LEAD, Role.MANAGER, Role.ADMIN].includes(user.role as Role);
    if (isManager) {
      return [RequestStatus.DRAFT, RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED, RequestStatus.ACTIVE, RequestStatus.EXPIRED];
    }
    return [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED, RequestStatus.ACTIVE, RequestStatus.EXPIRED];
  }

  private getTeamFilter(user: User, paramTeamId?: string): string | undefined {
    if (paramTeamId) return paramTeamId;
    const isManager = [Role.LEAD, Role.MANAGER, Role.ADMIN].includes(user.role as Role);
    if (!isManager) return user.teamId ?? undefined;
    return undefined;
  }
}
