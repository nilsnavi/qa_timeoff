import { Injectable } from '@nestjs/common';
import { LeaveRequestType, Prisma, RequestStatus, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { QueryEmployeeBalancesDto } from './dto/query-employee-balances.dto';

const BALANCE_TYPE_TO_LEAVE_TYPE: Record<string, LeaveRequestType[]> = {
  VACATION: [LeaveRequestType.VACATION],
  TIME_OFF: [LeaveRequestType.TIME_OFF],
  REMOTE_WORK: [LeaveRequestType.REMOTE_WORK],
  SICK_LEAVE: [],
  UNPAID_LEAVE: [LeaveRequestType.OTHER],
  BUSINESS_TRIP: [LeaveRequestType.OTHER],
};

const DEFAULT_ACCRUED: Record<string, number> = {
  VACATION: 160,
  TIME_OFF: 24,
  REMOTE_WORK: 0,
  SICK_LEAVE: 0,
  UNPAID_LEAVE: 0,
  BUSINESS_TRIP: 0,
};

export interface EmployeeBalanceRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeInitials: string;
  email?: string | null;
  telegramUsername?: string | null;
  department: string;
  role?: Role;
  balanceType: string;
  initialHours: number;
  accruedHours: number;
  usedHours: number;
  plannedHours: number;
  pendingHours: number;
  adjustmentHours: number;
  availableHours: number;
  projectedHours: number;
  updatedAt: string;
}

export interface EmployeeBalancesResponse {
  items: EmployeeBalanceRow[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalEmployees: number;
    totalAvailableHours: number;
    totalPlannedHours: number;
    totalPendingHours: number;
    negativeBalanceCount: number;
  };
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return fullName.slice(0, 2).toUpperCase();
}

type UserWithFields = {
  id: string;
  fullName: string;
  email: string | null;
  username: string | null;
  role: Role;
  teamId: string | null;
  team: { id: string; name: string } | null;
  timeBalance: { balanceHours: number; totalAddedHours: number; totalUsedHours: number; updatedAt: Date } | null;
};

@Injectable()
export class EmployeeBalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async getEmployeeBalances(currentUser: User, query: QueryEmployeeBalancesDto): Promise<EmployeeBalancesResponse> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 7, 50);
    const year = query.period ?? new Date().getFullYear();

    const users = await this.fetchVisibleUsers(currentUser, query);
    const userIds = users.map((u) => u.id);

    const periodStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const periodEnd = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const [leaveRequests, balanceOperations] = await Promise.all([
      this.fetchLeaveRequests(userIds, periodStart, periodEnd),
      this.fetchAdjustmentOperations(userIds, periodStart, periodEnd),
    ]);

    const requestByUserType = this.groupRequestsByUserType(leaveRequests);

    const now = new Date();
    const allRows: EmployeeBalanceRow[] = [];

    for (const user of users) {
      const userRequests = requestByUserType.get(user.id) ?? new Map<string, any[]>();
      const adjustments = balanceOperations.get(user.id) ?? 0;
      const totalAccrued = user.timeBalance?.totalAddedHours ?? 0;
      const updatedAt = user.timeBalance?.updatedAt?.toISOString() ?? new Date().toISOString();
      const activityTypes = this.getActivityTypes(userRequests);

      for (const balanceType of activityTypes) {
        const leaveTypes = BALANCE_TYPE_TO_LEAVE_TYPE[balanceType] ?? [balanceType as LeaveRequestType];
        const allReqs = leaveTypes.flatMap((lt) => userRequests.get(lt) ?? []);

        const usedHours = allReqs
          .filter((r) => this.isUsed(r, now))
          .reduce((s, r) => s + r.hours, 0);
        const plannedHours = allReqs
          .filter((r) => this.isPlanned(r, now))
          .reduce((s, r) => s + r.hours, 0);
        const pendingHours = allReqs
          .filter((r) => r.status === RequestStatus.PENDING)
          .reduce((s, r) => s + r.hours, 0);

        const accruedBase = balanceType === 'VACATION' && totalAccrued > 0
          ? Math.round(totalAccrued * 0.85)
          : balanceType === 'TIME_OFF' && totalAccrued > 0
            ? Math.round(totalAccrued * 0.15)
            : DEFAULT_ACCRUED[balanceType] ?? 0;

        const availableHours = accruedBase + adjustments - usedHours - plannedHours;
        const projectedHours = availableHours - pendingHours;

        allRows.push({
          id: `${user.id}-${balanceType}`,
          employeeId: user.id,
          employeeName: user.fullName,
          employeeInitials: getInitials(user.fullName),
          email: user.email ?? null,
          telegramUsername: user.username ?? null,
          department: user.team?.name ?? '—',
          role: user.role,
          balanceType,
          initialHours: 0,
          accruedHours: accruedBase,
          usedHours,
          plannedHours,
          pendingHours,
          adjustmentHours: adjustments,
          availableHours,
          projectedHours,
          updatedAt,
        });
      }

      if (activityTypes.length === 0) {
        const accruedBase = totalAccrued > 0 ? totalAccrued : DEFAULT_ACCRUED['VACATION'];
        allRows.push({
          id: `${user.id}-VACATION`,
          employeeId: user.id,
          employeeName: user.fullName,
          employeeInitials: getInitials(user.fullName),
          email: user.email ?? null,
          telegramUsername: user.username ?? null,
          department: user.team?.name ?? '—',
          role: user.role,
          balanceType: 'VACATION',
          initialHours: 0,
          accruedHours: accruedBase,
          usedHours: 0,
          plannedHours: 0,
          pendingHours: 0,
          adjustmentHours: 0,
          availableHours: accruedBase,
          projectedHours: accruedBase,
          updatedAt,
        });
      }
    }

    // Apply frontend filters
    let filtered = allRows;

    if (query.search) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(q) ||
          (r.email && r.email.toLowerCase().includes(q)) ||
          (r.telegramUsername && r.telegramUsername.toLowerCase().includes(q)) ||
          r.department.toLowerCase().includes(q),
      );
    }

    if (query.department) {
      filtered = filtered.filter((r) => r.department === query.department);
    }

    if (query.balanceType) {
      filtered = filtered.filter((r) => r.balanceType === query.balanceType);
    }

    if (query.status) {
      switch (query.status) {
        case 'NORMAL':
          filtered = filtered.filter((r) => r.availableHours > 16);
          break;
        case 'LOW':
          filtered = filtered.filter((r) => r.availableHours >= 0 && r.availableHours <= 16);
          break;
        case 'NEGATIVE':
          filtered = filtered.filter((r) => r.availableHours < 0);
          break;
        case 'HAS_PENDING':
          filtered = filtered.filter((r) => r.pendingHours > 0);
          break;
      }
    }

    if (query.problemOnly) {
      filtered = filtered.filter(
        (r) => r.availableHours <= 16 || r.availableHours < 0 || r.pendingHours > 0,
      );
    }

    // Sort
    if (query.sortBy) {
      const dir = query.sortDir === 'desc' ? -1 : 1;
      filtered.sort((a, b) => {
        const aVal = (a as any)[query.sortBy!];
        const bVal = (b as any)[query.sortBy!];
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return dir * aVal.localeCompare(bVal);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return dir * (aVal - bVal);
        }
        return 0;
      });
    }

    const total = filtered.length;
    const skip = (page - 1) * limit;
    const paged = filtered.slice(skip, skip + limit);

    const uniqueEmployees = new Set(filtered.map((r) => r.employeeId)).size;

    return {
      items: paged,
      total,
      page,
      limit,
      summary: {
        totalEmployees: uniqueEmployees,
        totalAvailableHours: filtered.reduce((s, r) => s + r.availableHours, 0),
        totalPlannedHours: filtered.reduce((s, r) => s + r.plannedHours, 0),
        totalPendingHours: filtered.reduce((s, r) => s + r.pendingHours, 0),
        negativeBalanceCount: filtered.filter((r) => r.availableHours < 0).length,
      },
    };
  }

  async recalculate(): Promise<{ success: boolean; updatedAt: string }> {
    return {
      success: true,
      updatedAt: new Date().toISOString(),
    };
  }

  private async fetchVisibleUsers(currentUser: User, query: QueryEmployeeBalancesDto): Promise<UserWithFields[]> {
    const where: Prisma.UserWhereInput = { isActive: true };
    const isAdminOrManager = currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER;
    const isLead = currentUser.role === Role.LEAD;

    if (!isAdminOrManager) {
      if (isLead && currentUser.teamId) {
        where.teamId = currentUser.teamId;
      } else {
        where.id = currentUser.id;
      }
    }

    if (isAdminOrManager && query.department) {
      where.team = { name: query.department };
    }

    if (isAdminOrManager && query.search) {
      const search = query.search;
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        teamId: true,
        team: { select: { id: true, name: true } },
        timeBalance: { select: { balanceHours: true, totalAddedHours: true, totalUsedHours: true, updatedAt: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  private async fetchLeaveRequests(userIds: string[], periodStart: Date, periodEnd: Date) {
    return this.prisma.leaveRequest.findMany({
      where: {
        userId: { in: userIds },
        dateFrom: { gte: periodStart, lt: periodEnd },
        status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] },
      },
      select: {
        id: true,
        userId: true,
        type: true,
        hours: true,
        status: true,
        dateFrom: true,
        dateTo: true,
      },
    });
  }

  private async fetchAdjustmentOperations(userIds: string[], periodStart: Date, periodEnd: Date) {
    const ops = await this.prisma.balanceOperation.findMany({
      where: {
        userId: { in: userIds },
        createdAt: { gte: periodStart, lt: periodEnd },
        operationType: 'MANUAL_CORRECTION',
      },
      select: { userId: true, hours: true },
    });

    const map = new Map<string, number>();
    for (const op of ops) {
      map.set(op.userId, (map.get(op.userId) ?? 0) + op.hours);
    }
    return map;
  }

  private groupRequestsByUserType(requests: { userId: string; type: LeaveRequestType }[]) {
    const map = new Map<string, Map<LeaveRequestType, any[]>>();
    for (const req of requests) {
      if (!map.has(req.userId)) {
        map.set(req.userId, new Map());
      }
      const userMap = map.get(req.userId)!;
      if (!userMap.has(req.type)) {
        userMap.set(req.type, []);
      }
      userMap.get(req.type)!.push(req);
    }
    return map;
  }

  private getActivityTypes(userRequests: Map<string, any[]>): string[] {
    const balanceTypes = new Set<string>();
    for (const [leaveType, reqs] of userRequests) {
      if (reqs.length === 0) continue;
      // Map LeaveRequestType to BalanceType
      for (const [bt, lts] of Object.entries(BALANCE_TYPE_TO_LEAVE_TYPE)) {
        if (lts.includes(leaveType as LeaveRequestType)) {
          balanceTypes.add(bt);
          break;
        }
      }
      if (!balanceTypes.has(leaveType)) {
        if (leaveType === 'VACATION') balanceTypes.add('VACATION');
        else if (leaveType === 'TIME_OFF') balanceTypes.add('TIME_OFF');
        else if (leaveType === 'REMOTE_WORK') balanceTypes.add('REMOTE_WORK');
      }
    }
    return balanceTypes.size > 0 ? Array.from(balanceTypes) : [];
  }

  private isUsed(req: { status: RequestStatus; dateFrom: Date }, now: Date): boolean {
    return (req.status === RequestStatus.APPROVED || req.status === RequestStatus.ACTIVE) && req.dateFrom <= now;
  }

  private isPlanned(req: { status: RequestStatus; dateFrom: Date }, now: Date): boolean {
    return req.status === RequestStatus.APPROVED && req.dateFrom > now;
  }
}
