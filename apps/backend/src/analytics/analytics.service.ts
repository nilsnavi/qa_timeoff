import { Injectable } from '@nestjs/common';
import { Prisma, RequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const NORMAL_HOURS = 8;
const INCREASED_HOURS = 16;
const OVERLOAD_HOURS = 32;

interface WorkloadParams {
  startDate?: string;
  endDate?: string;
  teamId?: string;
  userId?: string;
  status?: string;
}

interface CurrentUser {
  id: string;
  role: Role;
  teamId: string | null;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildUserFilter(currentUser: CurrentUser, params: WorkloadParams): Prisma.OvertimeWhereInput {
    const conditions: Prisma.OvertimeWhereInput[] = [];

    if (currentUser.role === Role.EMPLOYEE) {
      conditions.push({ userId: currentUser.id });
    } else if (currentUser.role === Role.LEAD && currentUser.teamId) {
      conditions.push({ user: { teamId: currentUser.teamId } });
    } else if (currentUser.role === Role.MANAGER) {
      conditions.push({
        user: {
          OR: [
            { teamId: currentUser.teamId ?? undefined },
            { managerId: currentUser.id },
          ].filter(c => Object.values(c).some(v => v !== undefined)),
        },
      });
    }

    if (params.userId) {
      conditions.push({ userId: params.userId });
    }
    if (params.teamId) {
      conditions.push({ user: { teamId: params.teamId } });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  async getWorkload(currentUser: CurrentUser, params: WorkloadParams = {}) {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const startDate = params.startDate ? new Date(params.startDate) : defaultStart;
    const endDate = params.endDate ? new Date(params.endDate) : defaultEnd;
    const userFilter = this.buildUserFilter(currentUser, params);

    const dateFilter = { date: { gte: startDate, lte: endDate } } as any;

    // ── Overtime by status ──────────────────────────────────────────
    const approvedWhere: Prisma.OvertimeWhereInput = {
      ...dateFilter,
      status: 'APPROVED',
      ...userFilter,
    };
    const pendingWhere: Prisma.OvertimeWhereInput = {
      ...dateFilter,
      status: 'CANCELLED',
      ...userFilter,
    };

    const [approvedOvertimes, cancelledOvertimes] = await Promise.all([
      this.prisma.overtime.findMany({
        where: approvedWhere,
        include: {
          user: { select: { id: true, fullName: true, teamId: true, team: { select: { id: true, name: true } } } },
        },
        orderBy: { date: 'asc' },
      }),
      this.prisma.overtime.findMany({
        where: pendingWhere,
        select: { id: true, hours: true, date: true, userId: true },
      }),
    ]);

    // ── Pending & approved timeoff/vacation ──────────────────────────
    const timeOffWhere: Prisma.TimeOffRequestWhereInput = {
      ...dateFilter,
      status: { in: ['APPROVED', 'PENDING', 'REJECTED', 'CANCELLED'] as RequestStatus[] },
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.teamId ? { user: { teamId: params.teamId } } : {}),
    };
    const vacationWhere: Prisma.VacationRequestWhereInput = {
      ...dateFilter,
      status: { in: ['APPROVED', 'PENDING', 'REJECTED', 'CANCELLED'] as RequestStatus[] },
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.teamId ? { user: { teamId: params.teamId } } : {}),
    };

    const [timeOffs, vacations] = await Promise.all([
      this.prisma.timeOffRequest.findMany({
        where: timeOffWhere,
        select: { id: true, hours: true, date: true, status: true, userId: true, user: { select: { id: true, fullName: true, teamId: true } } },
      }),
      this.prisma.vacationRequest.findMany({
        where: vacationWhere,
        select: { id: true, daysCount: true, startDate: true, endDate: true, status: true, userId: true, user: { select: { id: true, fullName: true, teamId: true } } },
      }),
    ]);

    // ── Pending count for recommendations ────────────────────────────
    const pendingTimeOffCount = timeOffs.filter(t => t.status === 'PENDING').length;
    const pendingVacationCount = vacations.filter(v => v.status === 'PENDING').length;

    // ── Workload by day ─────────────────────────────────────────────
    const dayMap = new Map<string, { approved: number; pending: number; rejected: number; cancelled: number; users: Set<string>; userDetails: Map<string, number>; pendingRequests: number }>();
    for (const ot of approvedOvertimes) {
      const key = ot.date.toISOString().split('T')[0];
      if (!dayMap.has(key)) dayMap.set(key, { approved: 0, pending: 0, rejected: 0, cancelled: 0, users: new Set(), userDetails: new Map(), pendingRequests: 0 });
      const d = dayMap.get(key)!;
      d.approved += ot.hours;
      d.users.add(ot.user.fullName);
      d.userDetails.set(ot.user.fullName, (d.userDetails.get(ot.user.fullName) ?? 0) + ot.hours);
    }
    for (const to of timeOffs) {
      const key = to.date.toISOString().split('T')[0];
      if (!dayMap.has(key)) dayMap.set(key, { approved: 0, pending: 0, rejected: 0, cancelled: 0, users: new Set(), userDetails: new Map(), pendingRequests: 0 });
      const d = dayMap.get(key)!;
      if (to.status === 'APPROVED') d.approved += to.hours;
      else if (to.status === 'PENDING') d.pending += to.hours;
      else if (to.status === 'REJECTED') d.rejected += to.hours;
      else if (to.status === 'CANCELLED') d.cancelled += to.hours;
      d.pendingRequests += to.status === 'PENDING' ? 1 : 0;
    }

    const workloadByDay = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date,
        approvedHours: data.approved,
        pendingHours: data.pending,
        rejectedHours: data.rejected,
        cancelledHours: data.cancelled,
        totalHours: data.approved + data.pending,
        users: Array.from(data.users).slice(0, 5),
        topUsers: Array.from(data.userDetails.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, hours]) => ({ name, hours })),
        pendingRequests: data.pendingRequests,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Anomaly detection ───────────────────────────────────────────
    const totalApprovedHours = approvedOvertimes.reduce((s, o) => s + o.hours, 0);
    let anomalyWarning: string | null = null;
    if (totalApprovedHours > 0 && workloadByDay.length > 0) {
      const maxDay = workloadByDay.reduce((a, b) => a.totalHours > b.totalHours ? a : b);
      if (maxDay.totalHours > 0 && maxDay.totalHours > totalApprovedHours * 0.5) {
        anomalyWarning = `Большая часть нагрузки приходится на ${maxDay.date}. Проверьте корректность данных.`;
      }
    }

    // ── Workload by user (with risk levels) ─────────────────────────
    const userMap = new Map<string, {
      userId: string; fullName: string; teamName: string; totalHours: number;
      approvedHours: number; pendingHours: number; rejectedHours: number; cancelledHours: number;
      requestCount: number; peakDay: string;
      riskLevel: 'normal' | 'increased' | 'overload' | 'critical';
      balanceHours: number;
    }>();
    for (const ot of approvedOvertimes) {
      const uid = ot.userId;
      if (!userMap.has(uid)) {
        const teamName = ot.user.team?.name ?? 'Без отдела';
        userMap.set(uid, { userId: uid, fullName: ot.user.fullName, teamName, totalHours: 0, approvedHours: 0, pendingHours: 0, rejectedHours: 0, cancelledHours: 0, requestCount: 0, peakDay: '', riskLevel: 'normal', balanceHours: 0 });
      }
      const u = userMap.get(uid)!;
      u.approvedHours += ot.hours;
      u.totalHours += ot.hours;
      u.requestCount++;
    }
    for (const to of timeOffs) {
      const uid = to.userId;
      if (!userMap.has(uid)) {
        const fn = to.user?.fullName ?? uid;
        const tn = (to.user as any)?.teamId ?? '';
        userMap.set(uid, { userId: uid, fullName: fn, teamName: tn, totalHours: 0, approvedHours: 0, pendingHours: 0, rejectedHours: 0, cancelledHours: 0, requestCount: 0, peakDay: '', riskLevel: 'normal', balanceHours: 0 });
      }
      const u = userMap.get(uid)!;
      if (to.status === 'APPROVED') u.approvedHours += to.hours;
      else if (to.status === 'PENDING') u.pendingHours += to.hours;
      else if (to.status === 'REJECTED') u.rejectedHours += to.hours;
      else if (to.status === 'CANCELLED') u.cancelledHours += to.hours;
      u.totalHours += to.hours;
    }

    // Peak day per user
    for (const ot of approvedOvertimes) {
      const uid = ot.userId;
      if (!userMap.has(uid)) continue;
      const key = ot.date.toISOString().split('T')[0];
      const u = userMap.get(uid)!;
      if (key > (u.peakDay || '')) u.peakDay = key;
    }

    // Risk levels & peak day
    for (const [_, u] of userMap) {
      if (u.totalHours >= OVERLOAD_HOURS) u.riskLevel = 'critical';
      else if (u.totalHours >= INCREASED_HOURS) {
        if (u.totalHours < OVERLOAD_HOURS) u.riskLevel = 'overload';
      }
      else if (u.totalHours >= NORMAL_HOURS) u.riskLevel = 'increased';
      else u.riskLevel = 'normal';
    }

    const workloadByUser = Array.from(userMap.values())
      .sort((a, b) => b.totalHours - a.totalHours);

    // ── Load balances for top users ─────────────────────────────────
    const userIds = workloadByUser.slice(0, 50).map(u => u.userId);
    if (userIds.length > 0) {
      const balances = await this.prisma.timeBalance.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, balanceHours: true },
      });
      const balanceMap = new Map(balances.map(b => [b.userId, b.balanceHours]));
      for (const u of workloadByUser) {
        u.balanceHours = balanceMap.get(u.userId) ?? 0;
      }
    }

    // ── Recommendations ─────────────────────────────────────────────
    const recommendations: string[] = [];
    const criticalUsers = workloadByUser.filter(u => u.riskLevel === 'critical');
    if (criticalUsers.length > 0) {
      recommendations.push(
        `Сотрудники с критической нагрузкой: ${criticalUsers.map(u => u.fullName).join(', ')}. Рекомендуется перераспределение задач и компенсационные отгулы.`,
      );
    }
    if (anomalyWarning) {
      recommendations.push(anomalyWarning);
    }
    if (pendingTimeOffCount + pendingVacationCount > 0) {
      recommendations.push(
        `Ожидают согласования: ${pendingTimeOffCount + pendingVacationCount} заявок. Рекомендуется проверить заявки команды.`,
      );
      if (pendingTimeOffCount > 3 || pendingVacationCount > 3) {
        recommendations.push(
          `Накоплено более 3 заявок в ожидании. Рекомендуется ускорить процесс согласования.`,
        );
      }
    }
    const overloadedUsers = workloadByUser.filter(u => u.riskLevel === 'overload' || u.riskLevel === 'critical');
    if (overloadedUsers.length > 0) {
      recommendations.push(
        `${overloadedUsers.length} сотрудников имеют повышенную нагрузку. Рассмотрите возможность компенсационных отгулов.`,
      );
    }

    // ── KPI cards ───────────────────────────────────────────────────
    const totalOvertime = approvedOvertimes.reduce((s, o) => s + o.hours, 0);
    const overloadedCount = workloadByUser.filter(u => u.riskLevel === 'overload' || u.riskLevel === 'critical').length;
    const avgLoad = workloadByUser.length > 0 ? Math.round(totalOvertime / workloadByUser.length) : 0;
    const topUser = workloadByUser[0] ?? null;
    const peakDayObj = workloadByDay.length > 0
      ? workloadByDay.reduce((a, b) => a.totalHours > b.totalHours ? a : b)
      : null;

    return {
      kpi: {
        totalOvertime,
        overloadedCount,
        avgLoad,
        topUser: topUser ? { fullName: topUser.fullName, hours: topUser.totalHours } : null,
        peakDay: peakDayObj ? { date: peakDayObj.date, hours: peakDayObj.totalHours } : null,
        pendingRequests: pendingTimeOffCount + pendingVacationCount,
      },
      workloadByDay,
      workloadByUser,
      anomalyWarning,
      recommendations,
    };
  }

  async getUserWorkloadDetail(currentUser: CurrentUser, targetUserId: string) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [user, overtimes, timeOffs, vacations, balance] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, fullName: true, email: true, role: true, team: { select: { id: true, name: true } } },
      }),
      this.prisma.overtime.findMany({
        where: { userId: targetUserId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'desc' },
        take: 50,
      }),
      this.prisma.timeOffRequest.findMany({
        where: { userId: targetUserId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'desc' },
        take: 50,
      }),
      this.prisma.vacationRequest.findMany({
        where: { userId: targetUserId, startDate: { lte: endDate }, endDate: { gte: startDate } },
        orderBy: { startDate: 'desc' },
        take: 20,
      }),
      this.prisma.timeBalance.findUnique({
        where: { userId: targetUserId },
        select: { balanceHours: true, totalAddedHours: true, totalUsedHours: true },
      }),
    ]);

    return { user, overtimes, timeOffs, vacations, balance };
  }
}
