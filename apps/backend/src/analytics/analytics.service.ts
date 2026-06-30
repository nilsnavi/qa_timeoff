import { Injectable } from '@nestjs/common';
import { Prisma, RequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface WorkloadQuery {
  dateFrom: string;
  dateTo: string;
  teamId?: string;
  employeeId?: string;
  status?: string;
  loadType?: string;
  unit?: string;
}

export interface CurrentUser {
  id: string;
  role: Role;
  teamId: string | null;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private buildVisibilityFilter(currentUser: CurrentUser, query: WorkloadQuery): Prisma.OvertimeWhereInput {
    const conditions: Prisma.OvertimeWhereInput[] = [];

    if (currentUser.role === Role.EMPLOYEE) {
      conditions.push({ userId: currentUser.id });
    } else if (currentUser.role === Role.LEAD && currentUser.teamId) {
      conditions.push({ user: { teamId: currentUser.teamId } });
    } else if (currentUser.role === Role.MANAGER) {
      const teamCond: Prisma.UserWhereInput = {};
      if (currentUser.teamId) teamCond.teamId = currentUser.teamId;
      conditions.push({
        user: { OR: [teamCond, { managerId: currentUser.id }].filter(c => Object.keys(c).length > 0) },
      });
    }

    if (query.employeeId) {
      conditions.push({ userId: query.employeeId });
    }
    if (query.teamId) {
      conditions.push({ user: { teamId: query.teamId } });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private calcRiskLevel(totalHours: number, periodDays: number): 'NORMAL' | 'WARNING' | 'HIGH' | 'CRITICAL' {
    const months = Math.max(1, Math.round(periodDays / 30));
    const monthlyLimit = 8 * months;
    if (totalHours <= monthlyLimit) return 'NORMAL';
    if (totalHours <= monthlyLimit * 2) return 'WARNING';
    if (totalHours <= monthlyLimit * 4) return 'HIGH';
    return 'CRITICAL';
  }

  private calcDayRiskLevel(hours: number): 'NORMAL' | 'WARNING' | 'HIGH' | 'CRITICAL' {
    if (hours <= 1) return 'NORMAL';
    if (hours <= 2) return 'WARNING';
    if (hours <= 4) return 'HIGH';
    return 'CRITICAL';
  }

  async getWorkload(currentUser: CurrentUser, query: WorkloadQuery) {
    const startDate = new Date(query.dateFrom);
    const endDate = new Date(query.dateTo);
    endDate.setHours(23, 59, 59, 999);
    const periodDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000));

    const statusFilter = query.status && query.status !== 'ALL'
      ? [query.status as RequestStatus]
      : ['APPROVED', 'PENDING', 'REJECTED', 'CANCELLED'] as RequestStatus[];

    const visibilityFilter = this.buildVisibilityFilter(currentUser, query);
    const dateFilter = { date: { gte: startDate, lte: endDate } } as any;

    // ── Fetch all overtime ──────────────────────────────────────────
    const overtimes = await this.prisma.overtime.findMany({
      where: { ...dateFilter, ...visibilityFilter },
      include: {
        user: { select: { id: true, fullName: true, teamId: true, role: true, team: { select: { id: true, name: true } }, position: true } },
      },
      orderBy: { date: 'asc' },
    });

    // ── Fetch timeoffs ──────────────────────────────────────────────
    const timeOffs = await this.prisma.timeOffRequest.findMany({
      where: {
        ...dateFilter,
        status: { in: statusFilter },
        ...(query.employeeId ? { userId: query.employeeId } : {}),
        ...(query.teamId ? { user: { teamId: query.teamId } } : {}),
      },
      select: {
        id: true, hours: true, date: true, status: true, userId: true,
        user: { select: { id: true, fullName: true, teamId: true, role: true, team: { select: { id: true, name: true } }, position: true } },
      },
    });

    // ── Merge all load items ────────────────────────────────────────
    type LoadItem = { userId: string; hours: number; date: Date; status: string; fullName: string; teamId: string | null; teamName: string | null; position: string | null; role: Role };
    const allLoad: LoadItem[] = [
      ...overtimes.map(o => ({
        userId: o.userId, hours: o.hours, date: o.date, status: o.status,
        fullName: o.user.fullName, teamId: o.user.teamId, role: o.user.role,
        teamName: o.user.team?.name ?? null, position: o.user.position ?? null,
      })),
      ...timeOffs.filter(_t => query.loadType === 'ALL' || query.loadType === 'TIMEOFF' || !query.loadType).map(t => ({
        userId: t.userId, hours: t.hours, date: t.date, status: t.status,
        fullName: t.user?.fullName ?? '', teamId: t.user?.teamId ?? null,
        role: t.user?.role as Role ?? 'EMPLOYEE',
        teamName: null, position: null,
      })),
    ];

    // ── Aggregate by employee ────────────────────────────────────────
    const employeeMap = new Map<string, {
      employeeId: string; fullName: string; shortName: string; teamId: string | null;
      teamName: string | null; position: string | null; role: Role;
      totalHours: number; approvedHours: number; pendingHours: number;
      rejectedHours: number; cancelledHours: number; requestsCount: number;
      peakDay: { date: string; hours: number } | null;
      lastTimeOffDate: string | null; timeOffBalanceHours: number;
      riskLevel: 'NORMAL' | 'WARNING' | 'HIGH' | 'CRITICAL';
      weeklyTrend: Array<{ date: string; hours: number }>;
    }>();

    for (const item of allLoad) {
      if (!employeeMap.has(item.userId)) {
        employeeMap.set(item.userId, {
          employeeId: item.userId, fullName: item.fullName,
          shortName: item.fullName.split(' ').slice(0, 2).join(' '),
          teamId: item.teamId, teamName: item.teamName, position: item.position, role: item.role,
          totalHours: 0, approvedHours: 0, pendingHours: 0,
          rejectedHours: 0, cancelledHours: 0, requestsCount: 0,
          peakDay: null, lastTimeOffDate: null, timeOffBalanceHours: 0,
          riskLevel: 'NORMAL', weeklyTrend: [],
        });
      }
      const e = employeeMap.get(item.userId)!;
      e.totalHours += item.hours;
      e.requestsCount++;
      if (item.status === 'APPROVED') e.approvedHours += item.hours;
      else if (item.status === 'PENDING') e.pendingHours += item.hours;
      else if (item.status === 'REJECTED') e.rejectedHours += item.hours;
      else if (item.status === 'CANCELLED') e.cancelledHours += item.hours;
    }

    // Peak day per employee
    for (const item of allLoad) {
      const e = employeeMap.get(item.userId);
      if (!e) continue;
      const dateStr = item.date.toISOString().split('T')[0];
      if (!e.peakDay || item.hours > e.peakDay.hours) {
        e.peakDay = { date: dateStr, hours: item.hours };
      }
    }

    // Risk levels
    for (const [_, e] of employeeMap) {
      e.riskLevel = this.calcRiskLevel(e.totalHours, periodDays);
    }

    // Weekly trend
    const weekMap = new Map<string, number>();
    for (const item of allLoad) {
      const d = new Date(item.date);
      const dayOfWeek = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const key = monday.toISOString().split('T')[0];
      weekMap.set(key, (weekMap.get(key) ?? 0) + item.hours);
    }
    const _weeklyTrend = Array.from(weekMap.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const [_, e] of employeeMap) {
      const empWeekMap = new Map<string, number>();
      for (const item of allLoad.filter(l => l.userId === e.employeeId)) {
        const d = new Date(item.date);
        const dayOfWeek = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        const key = monday.toISOString().split('T')[0];
        empWeekMap.set(key, (empWeekMap.get(key) ?? 0) + item.hours);
      }
      e.weeklyTrend = Array.from(empWeekMap.entries())
        .map(([date, hours]) => ({ date, hours }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Balances
    const empIds = Array.from(employeeMap.keys());
    if (empIds.length > 0) {
      const balances = await this.prisma.timeBalance.findMany({
        where: { userId: { in: empIds } },
        select: { userId: true, balanceHours: true },
      });
      const bMap = new Map(balances.map(b => [b.userId, b.balanceHours]));
      for (const [_, e] of employeeMap) {
        e.timeOffBalanceHours = bMap.get(e.employeeId) ?? 0;
      }
    }

    // Last timeoff
    const lastTimeoffs = await this.prisma.timeOffRequest.findMany({
      where: { userId: { in: empIds }, status: 'APPROVED' },
      orderBy: { date: 'desc' },
      take: empIds.length,
      select: { userId: true, date: true },
    });
    const lastTMap = new Map(lastTimeoffs.map(t => [t.userId, t.date.toISOString().split('T')[0]]));
    for (const [_, e] of employeeMap) {
      e.lastTimeOffDate = lastTMap.get(e.employeeId) ?? null;
    }

    const employeeLoad = Array.from(employeeMap.values())
      .sort((a, b) => b.totalHours - a.totalHours);

    // ── Daily load ──────────────────────────────────────────────────
    const dayMap = new Map<string, {
      totalHours: number; approvedHours: number; pendingHours: number;
      employeesCount: number; pendingRequestsCount: number;
      topEmployees: Array<{ employeeId: string; fullName: string; hours: number }>;
    }>();
    for (const item of allLoad) {
      const key = item.date.toISOString().split('T')[0];
      if (!dayMap.has(key)) dayMap.set(key, { totalHours: 0, approvedHours: 0, pendingHours: 0, employeesCount: 0, pendingRequestsCount: 0, topEmployees: [] });
      const d = dayMap.get(key)!;
      d.totalHours += item.hours;
      if (item.status === 'APPROVED') d.approvedHours += item.hours;
      if (item.status === 'PENDING') { d.pendingHours += item.hours; d.pendingRequestsCount++; }
    }

    // Employees per day & top
    for (const [key, _] of dayMap) {
      const dayItems = allLoad.filter(l => l.date.toISOString().split('T')[0] === key);
      const uniqueEmp = new Set(dayItems.map(l => l.userId));
      dayMap.get(key)!.employeesCount = uniqueEmp.size;
      const empHours = new Map<string, { employeeId: string; fullName: string; hours: number }>();
      for (const item of dayItems) {
        if (!empHours.has(item.userId)) empHours.set(item.userId, { employeeId: item.userId, fullName: item.fullName, hours: 0 });
        empHours.get(item.userId)!.hours += item.hours;
      }
      dayMap.get(key)!.topEmployees = Array.from(empHours.values()).sort((a, b) => b.hours - a.hours).slice(0, 5);
    }

    const dailyLoad = Array.from(dayMap.entries())
      .map(([date, data]) => ({
        date, ...data,
        isAnomaly: data.totalHours > 0 && (allLoad.reduce((s, l) => s + l.hours, 0) > 0) &&
          (data.totalHours / allLoad.reduce((s, l) => s + l.hours, 0)) > 0.5,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Summary / KPI ───────────────────────────────────────────────
    const totalApprovedHours = allLoad.filter(l => l.status === 'APPROVED').reduce((s, l) => s + l.hours, 0);
    const totalPendingHours = allLoad.filter(l => l.status === 'PENDING').reduce((s, l) => s + l.hours, 0);
    const totalOvertimeHours = totalApprovedHours + totalPendingHours;
    const activeEmployeesCount = employeeLoad.length;
    const overloadedEmployeesCount = employeeLoad.filter(e => e.riskLevel === 'HIGH' || e.riskLevel === 'CRITICAL').length;
    const averageOvertimePerEmployee = activeEmployeesCount > 0 ? Math.round(totalOvertimeHours / activeEmployeesCount) : 0;
    const topEmployee = employeeLoad[0] ?? null;
    const peakDay = dailyLoad.length > 0
      ? dailyLoad.reduce((a, b) => a.totalHours > b.totalHours ? a : b)
      : null;

    const peakDayInfo = peakDay ? {
      date: peakDay.date,
      hours: peakDay.totalHours,
      percentOfTotal: totalOvertimeHours > 0 ? Math.round((peakDay.totalHours / totalOvertimeHours) * 100) : 0,
    } : null;

    const pendingItems = allLoad.filter(l => l.status === 'PENDING');
    const pendingSum = pendingItems.reduce((s, l) => s + l.hours, 0);

    // ── Risk levels config ──────────────────────────────────────────
    const riskConfig = {
      levels: [
        { code: 'NORMAL', label: 'Норма', from: 0, to: 8 },
        { code: 'WARNING', label: 'Повышенная', from: 8, to: 16 },
        { code: 'HIGH', label: 'Перегруз', from: 16, to: 32 },
        { code: 'CRITICAL', label: 'Критично', from: 32, to: null },
      ],
      criticalEmployees: employeeLoad.filter(e => e.riskLevel === 'CRITICAL').map(e => ({
        employeeId: e.employeeId, fullName: e.fullName, hours: e.totalHours,
      })),
    };

    // ── Recommendations ─────────────────────────────────────────────
    const recommendations: Array<{ type: string; severity: string; title: string; description: string }> = [];
    const criticalCount = employeeLoad.filter(e => e.riskLevel === 'CRITICAL').length;
    if (criticalCount > 0) {
      recommendations.push({
        type: 'CRITICAL_OVERLOAD', severity: 'HIGH',
        title: `У ${criticalCount} сотрудников критический уровень перегруза.`,
        description: 'Рекомендуем запланировать компенсационные отгулы.',
      });
    }
    if (peakDay && peakDay.isAnomaly) {
      recommendations.push({
        type: 'ANOMALY_DAY', severity: 'WARNING',
        title: `${peakDay.date} лидирует по нагрузке — ${peakDay.totalHours} ч.`,
        description: 'Проверьте корректность данных или массовую загрузку.',
      });
    }
    const overloadCount = employeeLoad.filter(e => e.riskLevel === 'HIGH' || e.riskLevel === 'CRITICAL').length;
    if (overloadCount > criticalCount) {
      recommendations.push({
        type: 'HIGH_OVERLOAD', severity: 'WARNING',
        title: `У ${overloadCount} сотрудников нагрузка выше 32 ч.`,
        description: 'Рекомендуется перераспределить задачи внутри команды.',
      });
    }
    if (pendingItems.length > 0) {
      recommendations.push({
        type: 'PENDING_REQUESTS', severity: 'INFO',
        title: `${pendingItems.length} заявок ожидают согласования (${pendingSum} ч).`,
        description: 'Необходимо обработать до конца недели.',
      });
    }

    return {
      filters: { dateFrom: query.dateFrom, dateTo: query.dateTo, teamId: query.teamId ?? null, employeeId: query.employeeId ?? null, status: query.status ?? 'ALL', loadType: query.loadType ?? 'ALL', unit: query.unit ?? 'HOURS' },
      summary: { totalOvertimeHours, overloadedEmployeesCount, activeEmployeesCount, averageOvertimePerEmployee, topEmployee: topEmployee ? { id: topEmployee.employeeId, fullName: topEmployee.fullName, hours: topEmployee.totalHours, riskLevel: topEmployee.riskLevel } : null, peakDay: peakDayInfo, pendingRequests: { count: pendingItems.length, hours: pendingSum } },
      risk: riskConfig,
      dailyLoad,
      employeeLoad,
      recommendations,
    };
  }

  async exportCsv(currentUser: CurrentUser, query: WorkloadQuery): Promise<string> {
    const data = await this.getWorkload(currentUser, query);
    const header = 'Сотрудник;Команда;Всего часов;Согласовано;Ожидает;Отклонено;Отменено;Кол-во заявок;Пиковый день;Баланс отгулов;Уровень риска';
    const rows = data.employeeLoad.map(e =>
      `"${e.fullName}";"${e.teamName ?? ''}";${e.totalHours};${e.approvedHours};${e.pendingHours};${e.rejectedHours};${e.cancelledHours};${e.requestsCount};"${e.peakDay?.date ?? ''} (${e.peakDay?.hours ?? 0} ч)";${e.timeOffBalanceHours};${e.riskLevel}`,
    );
    return '\uFEFF' + [header, ...rows].join('\n');
  }

  async exportExcel(currentUser: CurrentUser, query: WorkloadQuery): Promise<Buffer> {
    const csv = await this.exportCsv(currentUser, query);
    return Buffer.from(csv, 'utf-8');
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
        orderBy: { date: 'desc' }, take: 50,
      }),
      this.prisma.timeOffRequest.findMany({
        where: { userId: targetUserId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'desc' }, take: 50,
      }),
      this.prisma.vacationRequest.findMany({
        where: { userId: targetUserId, startDate: { lte: endDate }, endDate: { gte: startDate } },
        orderBy: { startDate: 'desc' }, take: 20,
      }),
      this.prisma.timeBalance.findUnique({
        where: { userId: targetUserId },
        select: { balanceHours: true, totalAddedHours: true, totalUsedHours: true },
      }),
    ]);

    return { user, overtimes, timeOffs, vacations, balance };
  }
}
