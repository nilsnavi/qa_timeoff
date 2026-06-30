import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, RequestStatus, LeaveRequestType } from '@prisma/client';
import { HolidaysService } from '../calendar/holidays.service';
import { CompanySettingsService } from '../company-settings/company-settings.service';

export interface DashboardQuery {
  dateFrom?: string;
  dateTo?: string;
  teamId?: string;
}

export interface CalendarDay {
  date: string;
  approvedAbsences: number;
  pendingAbsences: number;
  availabilityPercent: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  events: Array<{
    employeeName: string;
    type: string;
    status: string;
    hours: number;
  }>;
}

export interface AttentionItem {
  type: string;
  severity: 'SUCCESS' | 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  description: string;
  actionLabel?: string;
  actionUrl?: string;
}

export interface InsightItem {
  type: string;
  severity: 'INFO' | 'WARNING' | 'SUCCESS';
  title: string;
  description: string;
}

export interface ActivityItem {
  type: string;
  severity: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
  title: string;
  description: string;
  createdAt: string;
  timeAgo: string;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly holidaysService: HolidaysService,
    private readonly companySettingsService: CompanySettingsService,
  ) {}

  async getSummary(user: {
    id: string;
    fullName: string;
    role: Role;
    teamId: string | null;
    position: string | null;
    organizationId: string;
  }, query: DashboardQuery) {
    const isManager = user.role === Role.MANAGER || user.role === Role.ADMIN;
    const isLead = user.role === Role.LEAD;
    const canViewTeam = isManager || (isLead && user.teamId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    const fourteenDaysFromNow = new Date(today);
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);

    const teamIds = isManager
      ? (query.teamId ? [query.teamId] : await this.getAllTeamIds(user.organizationId))
      : isLead && user.teamId
        ? [user.teamId]
        : [];

    const holidays = await this.holidaysService.getHolidays(today.getFullYear());
    const company = await this.companySettingsService.get();

    const [timeBalance, allEmployees, leaveRequests, pendingApprovals, auditLogs, notifications, overtimeRequests] = await Promise.all([
      this.prisma.timeBalance.findUnique({ where: { userId: user.id } }),
      this.prisma.user.findMany({
        where: {
          organizationId: user.organizationId,
          isActive: true,
          ...(teamIds.length ? { teamId: { in: teamIds } } : {}),
        },
        select: { id: true, fullName: true, teamId: true, position: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          ...(canViewTeam && teamIds.length
            ? { teamId: { in: teamIds } }
            : { userId: user.id }),
          status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.CANCELLED] },
        },
        include: { user: { select: { id: true, fullName: true, teamId: true } } },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          status: RequestStatus.PENDING,
          ...(canViewTeam && teamIds.length
            ? { teamId: { in: teamIds }, userId: { not: user.id } }
            : { userId: user.id }),
        },
        include: { user: { select: { id: true, fullName: true, teamId: true } } },
        orderBy: { createdAt: 'asc' },
        take: 5,
      }),
      this.prisma.auditLog.findMany({
        where: {
          actor: { organizationId: user.organizationId },
          ...(canViewTeam && teamIds.length
            ? { OR: [{ entityType: 'request' }, { actor: { teamId: { in: teamIds } } }] }
            : { actorId: user.id }),
        },
        include: { actor: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.overtime.findMany({
        where: {
          status: 'APPROVED',
          user: { organizationId: user.organizationId, ...(teamIds.length ? { teamId: { in: teamIds } } : {}) },
          date: { gte: startOfMonth, lte: endOfMonth },
          ...(teamIds.length ? {} : { userId: user.id }),
        },
        include: { user: { select: { id: true, fullName: true } } },
      }),
    ]);

    const activeEmployeesCount = allEmployees.length;
    const balance_ = timeBalance ?? { balanceHours: 0, totalAddedHours: 0, totalUsedHours: 0 };
    const availableHours = balance_.totalAddedHours - balance_.totalUsedHours;
    const totalHours = balance_.totalAddedHours;
    const usedPercent = totalHours > 0 ? Math.round((balance_.totalUsedHours / totalHours) * 100) : 0;

    const myPending = leaveRequests.filter(r => r.userId === user.id && r.status === RequestStatus.PENDING).length;
    const myApprovedThisMonth = leaveRequests.filter(r =>
      r.userId === user.id &&
      r.status === RequestStatus.APPROVED &&
      r.approvedAt &&
      new Date(r.approvedAt) >= startOfMonth &&
      new Date(r.approvedAt) <= endOfMonth,
    ).length;

    const pendingApprovalList = leaveRequests.filter(r =>
      r.status === RequestStatus.PENDING && (canViewTeam ? r.userId !== user.id : r.userId === user.id)
    );
    const pendingApprovalCount = pendingApprovalList.length;
    const pendingApprovalHours = pendingApprovalList.reduce((sum, r) => sum + r.hours, 0);

    const approvedLeaveRequests = leaveRequests.filter(r => r.status === RequestStatus.APPROVED);
    const todayAbsences = approvedLeaveRequests.filter(r =>
      new Date(r.dateFrom) <= today && (r.dateTo ? new Date(r.dateTo) >= today : new Date(r.dateFrom).toDateString() === today.toDateString())
    );
    const todayAbsenceByType: Record<string, number> = {};
    todayAbsences.forEach(r => {
      todayAbsenceByType[r.type] = (todayAbsenceByType[r.type] || 0) + 1;
    });

    const overtimeByUser = new Map<string, number>();
    overtimeRequests.forEach(r => {
      overtimeByUser.set(r.userId, (overtimeByUser.get(r.userId) || 0) + r.hours);
    });
    const criticalEmployees = Array.from(overtimeByUser.entries())
      .filter(([, hours]) => hours > 32)
      .map(([userId, hours]) => ({ userId, hours }));
    const criticalEmployeeCount = criticalEmployees.length;

    let riskLevel: string;
    if (criticalEmployeeCount === 0) riskLevel = 'LOW';
    else if (criticalEmployeeCount <= 2) riskLevel = 'MEDIUM';
    else if (criticalEmployeeCount <= 5) riskLevel = 'HIGH';
    else riskLevel = 'CRITICAL';

    const todayAvailable = activeEmployeesCount - todayAbsences.length;
    const todayAvailabilityPercent = activeEmployeesCount > 0
      ? Math.round((todayAvailable / activeEmployeesCount) * 100)
      : 100;

    const attention: AttentionItem[] = [];

    if (pendingApprovalCount > 0) {
      attention.push({
        type: 'PENDING_APPROVAL',
        severity: 'WARNING',
        title: `${pendingApprovalCount} заявок ожидают согласования`,
        description: 'Перейдите к списку для обработки',
        actionLabel: 'Перейти',
        actionUrl: '/requests/manager',
      });
    }

    const nowHours = Date.now();
    const overduePending = pendingApprovalList.filter(r => {
      const createdAt = new Date(r.createdAt).getTime();
      return (nowHours - createdAt) > 24 * 60 * 60 * 1000;
    });
    if (overduePending.length === 0) {
      attention.push({
        type: 'NO_OVERDUE',
        severity: 'SUCCESS',
        title: 'Нет просроченных заявок',
        description: 'Все заявки обрабатываются вовремя',
      });
    } else {
      attention.push({
        type: 'OVERDUE_REQUESTS',
        severity: overduePending.length > 2 ? 'CRITICAL' : 'WARNING',
        title: `${overduePending.length} просроченных заявок`,
        description: 'Заявки ожидают более 24 часов',
        actionLabel: 'Обработать',
        actionUrl: '/requests/manager',
      });
    }

    if (availableHours < 16) {
      attention.push({
        type: 'LOW_BALANCE',
        severity: 'WARNING',
        title: 'Низкий баланс часов',
        description: `Доступно только ${availableHours} ч`,
        actionLabel: 'Баланс',
        actionUrl: '/balance',
      });
    } else {
      attention.push({
        type: 'BALANCE_OK',
        severity: 'SUCCESS',
        title: 'Баланс в порядке',
        description: `Доступно ${availableHours} ч`,
      });
    }

    if (todayAvailabilityPercent < 70) {
      attention.push({
        type: 'LOW_AVAILABILITY',
        severity: 'WARNING',
        title: 'Есть риск нехватки сотрудников',
        description: `Доступность команды: ${todayAvailabilityPercent}%`,
        actionLabel: 'Календарь',
        actionUrl: '/calendar',
      });
    }

    if (criticalEmployeeCount > 0) {
      attention.push({
        type: 'OVERLOAD',
        severity: 'WARNING',
        title: 'Есть сотрудники с перегрузом',
        description: `${criticalEmployeeCount} сотрудников в критической зоне`,
        actionLabel: 'Нагрузка',
        actionUrl: '/analytics',
      });
    }

    const noUpcomingAbsences = leaveRequests.filter(r =>
      r.status === RequestStatus.APPROVED &&
      new Date(r.dateFrom) >= today &&
      new Date(r.dateFrom) <= fourteenDaysFromNow,
    ).length === 0;
    if (noUpcomingAbsences) {
      attention.push({
        type: 'NO_UPCOMING',
        severity: 'INFO',
        title: 'На этой неделе нет запланированных отпусков',
        description: 'Команда полностью доступна',
      });
    }

    const quickActions: Array<{ label: string; icon: string; url: string }> = [];
    if (user.role === Role.EMPLOYEE) {
      quickActions.push(
        { label: 'Новый отгул', icon: 'plus', url: '/timeoff/new' },
        { label: 'Новый отпуск', icon: 'calendar', url: '/vacation/new' },
        { label: 'Мои заявки', icon: 'file-text', url: '/requests/my' },
        { label: 'Мой баланс', icon: 'wallet', url: '/balance' },
      );
    } else if (user.role === Role.LEAD || user.role === Role.MANAGER) {
      quickActions.push(
        { label: 'Новый отгул', icon: 'plus', url: '/timeoff/new' },
        { label: 'Согласовать', icon: 'check-circle', url: '/requests/manager' },
        { label: 'Команда', icon: 'users', url: '/team' },
        { label: 'Календарь', icon: 'calendar', url: '/calendar' },
      );
    } else {
      quickActions.push(
        { label: 'Новый отгул', icon: 'plus', url: '/timeoff/new' },
        { label: 'Сотрудники', icon: 'users', url: '/team' },
        { label: 'Импорт', icon: 'upload', url: '/admin' },
        { label: 'Настройки', icon: 'settings', url: '/admin' },
        { label: 'Журналы', icon: 'file-text', url: '/admin' },
      );
    }

    const calendarDays: CalendarDay[] = [];
    const calendarStart = new Date(today);
    calendarStart.setDate(1); // start from 1st day of current month
    for (let i = 0; i < 35; i++) {
      const dayDate = new Date(calendarStart);
      dayDate.setDate(dayDate.getDate() + i);
      dayDate.setHours(0, 0, 0, 0);

      const dayApproved = approvedLeaveRequests.filter(r =>
        new Date(r.dateFrom) <= dayDate && (r.dateTo ? new Date(r.dateTo) >= dayDate : new Date(r.dateFrom).toDateString() === dayDate.toDateString())
      );
      const dayPending = pendingApprovalList.filter(r =>
        !approvedLeaveRequests.includes(r) &&
        new Date(r.dateFrom) <= dayDate && (r.dateTo ? new Date(r.dateTo) >= dayDate : new Date(r.dateFrom).toDateString() === dayDate.toDateString())
      );

      const dayAvailable = activeEmployeesCount - dayApproved.length;
      const dayAvailabilityPercent = activeEmployeesCount > 0
        ? Math.round((dayAvailable / activeEmployeesCount) * 100)
        : 100;

      let dayStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      if (dayAvailabilityPercent < 60) dayStatus = 'CRITICAL';
      else if (dayAvailabilityPercent < 80) dayStatus = 'WARNING';

      const dateStr = dayDate.toISOString().split('T')[0];
      const isHoliday = holidays.includes(dateStr);

      calendarDays.push({
        date: dateStr,
        approvedAbsences: dayApproved.length,
        pendingAbsences: dayPending.length,
        availabilityPercent: dayAvailabilityPercent,
        status: isHoliday ? 'NORMAL' : dayStatus,
        events: [
          ...(isHoliday ? [{ employeeName: 'Праздник', type: 'HOLIDAY', status: 'APPROVED' as const, hours: 0 }] : []),
          ...dayApproved.map(r => ({
            employeeName: r.user.fullName,
            type: r.type,
            status: 'APPROVED',
            hours: r.hours,
          })),
          ...dayPending.map(r => ({
            employeeName: r.user.fullName,
            type: r.type,
            status: 'PENDING',
            hours: r.hours,
          })),
        ],
      });
    }

    const pendingApprovalsForList = pendingApprovals.map(r => ({
      id: r.id,
      employeeName: r.user.fullName,
      employeeInitials: r.user.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      type: r.type,
      typeLabel: r.type === LeaveRequestType.TIME_OFF ? 'Отгул' : 'Отпуск',
      hours: r.hours,
      dateFrom: r.dateFrom.toISOString().split('T')[0],
      dateTo: r.dateTo ? r.dateTo.toISOString().split('T')[0] : r.dateFrom.toISOString().split('T')[0],
      createdAt: r.createdAt.toISOString(),
    }));

    const teamAvailabilityDays = [];
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(today);
      dayDate.setDate(dayDate.getDate() + i);
      dayDate.setHours(0, 0, 0, 0);

      const dayApproved = approvedLeaveRequests.filter(r =>
        new Date(r.dateFrom) <= dayDate && (r.dateTo ? new Date(r.dateTo) >= dayDate : new Date(r.dateFrom).toDateString() === dayDate.toDateString())
      );
      const dayAvail = activeEmployeesCount - dayApproved.length;
      const dayPercent = activeEmployeesCount > 0
        ? Math.round((dayAvail / activeEmployeesCount) * 100)
        : 100;

      let daySt: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      if (dayPercent < 60) daySt = 'CRITICAL';
      else if (dayPercent < 70) daySt = 'WARNING';

      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      const dayOfWeek = dayDate.getDay();
      const dowLabel = dayNames[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
      const dd = String(dayDate.getDate()).padStart(2, '0');
      const mm = String(dayDate.getMonth() + 1).padStart(2, '0');

      teamAvailabilityDays.push({
        date: dayDate.toISOString().split('T')[0],
        label: `${dowLabel} ${dd}.${mm}`,
        availabilityPercent: dayPercent,
        status: daySt,
      });
    }

    const upcomingEvents = [];
    for (const req of leaveRequests.filter(r =>
      (r.status === RequestStatus.APPROVED || r.status === RequestStatus.PENDING) &&
      new Date(r.dateFrom) >= today &&
      new Date(r.dateFrom) <= fourteenDaysFromNow,
    )) {
      const dateLabel = new Date(req.dateFrom).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
      upcomingEvents.push({
        date: req.dateFrom.toISOString().split('T')[0],
        dateLabel,
        title: `${req.user.fullName} — ${req.type === LeaveRequestType.TIME_OFF ? 'отгул' : 'отпуск'} ${req.hours} ч`,
        description: 'Весь день',
        type: req.type,
        severity: req.status === RequestStatus.PENDING ? 'WARNING' : 'INFO',
      });
    }

    const funnel = {
      draft: leaveRequests.filter(r => r.status === RequestStatus.DRAFT).length,
      pending: leaveRequests.filter(r => r.status === RequestStatus.PENDING).length,
      approved: leaveRequests.filter(r => r.status === RequestStatus.APPROVED).length,
      rejected: leaveRequests.filter(r => r.status === RequestStatus.REJECTED).length,
      cancelled: leaveRequests.filter(r => r.status === RequestStatus.CANCELLED).length,
    };

    const prevMonthRequests = await this.prisma.leaveRequest.count({
      where: {
        user: { organizationId: user.organizationId },
        ...(canViewTeam && teamIds.length
          ? { teamId: { in: teamIds } }
          : { userId: user.id }),
        createdAt: { gte: prevMonthStart, lte: prevMonthEnd },
      },
    });
    const currentMonthRequests = leaveRequests.filter(r =>
      new Date(r.createdAt) >= startOfMonth && new Date(r.createdAt) <= endOfMonth,
    ).length;
    const requestTrend = prevMonthRequests > 0
      ? Math.round(((currentMonthRequests - prevMonthRequests) / prevMonthRequests) * 100)
      : null;

    const processedRequests = leaveRequests.filter(r =>
      r.status === RequestStatus.APPROVED || r.status === RequestStatus.REJECTED
    );
    const approvalRate = processedRequests.length > 0
      ? Math.round((processedRequests.filter(r => r.status === RequestStatus.APPROVED).length / processedRequests.length) * 100)
      : 100;

    const approvedWithTime = leaveRequests.filter(r => r.status === RequestStatus.APPROVED && r.approvedAt);
    let averageApprovalTimeHours = 0;
    if (approvedWithTime.length > 0) {
      const totalTime = approvedWithTime.reduce((sum, r) => {
        return sum + (new Date(r.approvedAt!).getTime() - new Date(r.createdAt).getTime());
      }, 0);
      averageApprovalTimeHours = Math.round((totalTime / approvedWithTime.length / 3600000) * 100) / 100;
    }

    const insights: InsightItem[] = [];

    insights.push({
      type: 'BALANCE_USAGE',
      severity: 'INFO',
      title: `Использовано только ${usedPercent}% доступного баланса`,
      description: 'Баланс в хорошем состоянии',
    });

    if (overduePending.length === 0) {
      insights.push({
        type: 'NO_OVERDUE',
        severity: 'SUCCESS',
        title: 'Нет просроченных заявок',
        description: 'Все заявки в процессе',
      });
    }

    if (averageApprovalTimeHours > 0) {
      const h = Math.floor(averageApprovalTimeHours);
      const m = Math.round((averageApprovalTimeHours - h) * 60);
      insights.push({
        type: 'APPROVAL_SPEED',
        severity: 'INFO',
        title: `Среднее время согласования — ${h} ч ${m} мин`,
        description: 'Система работает эффективно',
      });
    }

    if (requestTrend !== null) {
      const trendText = requestTrend >= 0
        ? `Заявок за месяц стало на ${requestTrend}% больше`
        : `Заявок за месяц стало на ${Math.abs(requestTrend)}% меньше`;
      insights.push({
        type: 'TREND',
        severity: requestTrend > 20 ? 'WARNING' : 'INFO',
        title: trendText,
        description: 'Динамика относительно прошлого месяца',
      });
    }

    if (criticalEmployeeCount > 0) {
      insights.push({
        type: 'OVERLOAD',
        severity: 'WARNING',
        title: `${criticalEmployeeCount} сотрудников с перегрузом`,
        description: 'Проверьте нагрузку команды',
      });
    }

    const activity: ActivityItem[] = [];

    for (const entry of auditLogs.slice(0, 10)) {
      activity.push({
        type: entry.action,
        severity: 'INFO',
        title: `${entry.action}`,
        description: entry.actor?.fullName ?? 'Система',
        createdAt: entry.createdAt.toISOString(),
        timeAgo: this.timeAgo(new Date(entry.createdAt)),
      });
    }

    for (const n of notifications.slice(0, 10)) {
      activity.push({
        type: n.type,
        severity: 'INFO',
        title: n.title,
        description: n.message,
        createdAt: n.createdAt.toISOString(),
        timeAgo: this.timeAgo(new Date(n.createdAt)),
      });
    }

    activity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const activityFeed = activity.slice(0, 10);

    const onboardingShow = activeEmployeesCount === 0 || (teamIds.length === 0 && canViewTeam);

    const userTeam = allEmployees.find(e => e.id === user.id)?.teamId
      ? await this.prisma.team.findUnique({ where: { id: user.teamId ?? undefined }, select: { name: true } })
      : null;

    const greetingProfile = {
      id: user.id,
      fullName: user.fullName,
      shortName: user.fullName.split(' ')[1] || user.fullName.split(' ')[0],
      role: user.role,
      teamId: user.teamId,
      teamName: userTeam?.name ?? null,
      position: user.position ?? 'Сотрудник',
      status: 'ACTIVE',
      avatarUrl: null,
    };

    let greetingText = `У вас доступно ${availableHours} ч, ${myPending} заявок ожидают решения.`;
    if (user.role === Role.LEAD || user.role === Role.MANAGER) {
      greetingText = `В вашей команде ${pendingApprovalCount} заявок ожидают согласования, ${todayAbsences.length} сотрудника отсутствуют сегодня.`;
    } else if (user.role === Role.ADMIN) {
      greetingText = `В организации ${activeEmployeesCount} сотрудников, ${pendingApprovalCount} заявок ожидают согласования, ${criticalEmployeeCount} сотрудников с перегрузом.`;
    }

    return {
      profile: greetingProfile,
      greeting: greetingText,
      company: {
        name: company.companyName,
        timezone: company.timezone,
        workingHoursPerDay: company.workingHoursPerDay,
        minimumTeamCoveragePercent: company.minimumTeamCoveragePercent,
      },
      balance: {
        availableHours,
        usedHours: balance_.totalUsedHours,
        totalHours,
        usedPercent,
      },
      requests: {
        myPending,
        myApprovedThisMonth,
        pendingApprovalCount,
        pendingApprovalHours,
        approvalRate,
        averageApprovalTimeHours,
      },
      team: {
        employeesCount: activeEmployeesCount,
        absentToday: todayAbsences.length,
        absenceByType: todayAbsenceByType,
        availableToday: todayAvailable,
        availabilityPercent: todayAvailabilityPercent,
        overloadedEmployees: criticalEmployeeCount,
        riskLevel,
      },
      attention,
      quickActions,
      calendar: calendarDays,
      pendingApprovals: pendingApprovalsForList,
      teamAvailability: teamAvailabilityDays,
      upcomingEvents,
      funnel,
      insights,
      activity: activityFeed,
      notifications: notifications.map(n => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      onboarding: {
        show: onboardingShow,
        steps: onboardingShow ? [
          { title: 'Добавьте сотрудников', action: 'team' },
          { title: 'Создайте команды', action: 'team' },
          { title: 'Настройте баланс часов', action: 'balance' },
          { title: 'Создайте первую заявку', action: 'timeoff/new' },
        ] : [],
      },
    };
  }


  private async getAllTeamIds(organizationId: string): Promise<string[]> {
    const teams = await this.prisma.team.findMany({
      where: { organizationId },
      select: { id: true },
    });
    return teams.map(t => t.id);
  }

  private timeAgo(date: Date): string {
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH} ч назад`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} дн назад`;
    return date.toLocaleDateString('ru-RU');
  }
}
