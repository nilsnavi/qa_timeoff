import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ForecastResult {
  generatedAt: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  predictedOvertimeHours: number;
  overloadedUsers: Array<{
    userId: string;
    fullName: string;
    teamName: string;
    currentOvertime: number;
    predictedOvertime: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
  recommendations: string[];
  period: {
    start: string;
    end: string;
  };
}

@Injectable()
export class AiForecastService {
  private readonly logger = new Logger(AiForecastService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rule-based forecast for overtime risk assessment.
   * Analyzes historical data and current trends to predict future overtime.
   * Designed with interface that can be replaced with Gemini/OpenAI API later.
   */
  async getOvertimeForecast(params?: {
    teamId?: string;
    monthsLookback?: number;
  }): Promise<ForecastResult> {
    const now = new Date();
    const lookbackMonths = params?.monthsLookback ?? 3;

    const startDate = new Date(now.getFullYear(), now.getMonth() - lookbackMonths, 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

    // Get all active users
    const userWhere: { isActive: boolean; teamId?: string } = { isActive: true };
    if (params?.teamId) userWhere.teamId = params.teamId;

    const users = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        fullName: true,
        team: { select: { id: true, name: true } },
        hourlyRate: true,
      },
    });

    // Get overtime data for the period
    const overtimes = await this.prisma.overtime.findMany({
      where: {
        date: { gte: startDate },
        status: 'APPROVED',
        ...(params?.teamId ? { user: { teamId: params.teamId } } : {}),
      },
      include: {
        user: {
          select: { id: true, fullName: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate monthly overtime per user
    const userMonthlyOvertime = new Map<string, Map<string, number>>();

    for (const ot of overtimes) {
      const monthKey = `${ot.date.getFullYear()}-${String(ot.date.getMonth() + 1).padStart(2, '0')}`;
      if (!userMonthlyOvertime.has(ot.userId)) {
        userMonthlyOvertime.set(ot.userId, new Map());
      }
      const monthMap = userMonthlyOvertime.get(ot.userId)!;
      monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + ot.hours);
    }

    // Get absences for the future period
    const upcomingAbsences = await this.prisma.timeOffRequest.findMany({
      where: {
        date: { gte: now },
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: { userId: true, date: true, hours: true },
    });

    // Calculate absence hours per user for next month
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

    const userAbsenceHours = new Map<string, number>();
    for (const absence of upcomingAbsences) {
      if (absence.date >= nextMonthStart && absence.date <= nextMonthEnd) {
        userAbsenceHours.set(absence.userId, (userAbsenceHours.get(absence.userId) ?? 0) + absence.hours);
      }
    }

    // Also get vacation absences
    const upcomingVacations = await this.prisma.vacationRequest.findMany({
      where: {
        startDate: { lte: nextMonthEnd },
        endDate: { gte: nextMonthStart },
        status: { in: ['APPROVED', 'PENDING'] },
      },
      select: { userId: true, daysCount: true },
    });

    for (const vac of upcomingVacations) {
      userAbsenceHours.set(vac.userId, (userAbsenceHours.get(vac.userId) ?? 0) + vac.daysCount * 8);
    }

    // ── Rule-based prediction ─────────────────────────────────────────
    const overloadedUsers: ForecastResult['overloadedUsers'] = [];
    let totalPredictedOvertime = 0;
    let maxRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    for (const user of users) {
      const monthlyData = userMonthlyOvertime.get(user.id);
      if (!monthlyData || monthlyData.size === 0) {
        continue; // No overtime history
      }

      // Calculate average monthly overtime over last months
      let totalOverHistory = 0;
      let monthsWithData = 0;
      for (const hours of monthlyData.values()) {
        totalOverHistory += hours;
        monthsWithData++;
      }
      const avgMonthlyOvertime = monthsWithData > 0 ? Math.round(totalOverHistory / monthsWithData) : 0;

      // Get current month overtime
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentOvertime = monthlyData.get(currentMonthKey) ?? 0;

      // Get trend direction (last 3 months)
      const sortedMonths = Array.from(monthlyData.keys()).sort();
      const recentMonths = sortedMonths.slice(-3);
      let trend = 0;
      if (recentMonths.length >= 2) {
        const first = monthlyData.get(recentMonths[0]) ?? 0;
        const last = monthlyData.get(recentMonths[recentMonths.length - 1]) ?? 0;
        trend = last - first;
      }

      // Predict next month overtime based on average + trend
      const absencePenalty = userAbsenceHours.get(user.id) ?? 0;
      let predictedOvertime = Math.max(0, avgMonthlyOvertime + Math.round(trend * 0.5) - Math.round(absencePenalty * 0.3));
      totalPredictedOvertime += predictedOvertime;

      // Determine risk level
      let userRisk: 'LOW' | 'MEDIUM' | 'HIGH';
      if (predictedOvertime >= 20 || (currentOvertime >= 15 && trend > 0)) {
        userRisk = 'HIGH';
      } else if (predictedOvertime >= 10 || currentOvertime >= 8) {
        userRisk = 'MEDIUM';
      } else {
        userRisk = 'LOW';
      }

      if (userRisk === 'HIGH') maxRiskLevel = 'HIGH';
      else if (userRisk === 'MEDIUM' && maxRiskLevel !== 'HIGH') maxRiskLevel = 'MEDIUM';

      const teamName = user.team?.name ?? 'Без отдела';

      overloadedUsers.push({
        userId: user.id,
        fullName: user.fullName,
        teamName,
        currentOvertime,
        predictedOvertime,
        riskLevel: userRisk,
      });
    }

    // Sort by predicted overtime descending
    overloadedUsers.sort((a, b) => b.predictedOvertime - a.predictedOvertime);

    // ── Generate recommendations ──────────────────────────────────────
    const recommendations: string[] = [];
    const highRiskUsers = overloadedUsers.filter((u) => u.riskLevel === 'HIGH');
    const medRiskUsers = overloadedUsers.filter((u) => u.riskLevel === 'MEDIUM');

    // Team-level recommendations
    if (params?.teamId) {
      const teamName = users[0]?.team?.name ?? 'команде';
      if (highRiskUsers.length > 0) {
        recommendations.push(
          `В ${teamName} ожидается высокая нагрузка. Рекомендуется перераспределить задачи или согласовать дополнительный ресурс.`,
        );
      }
    }

    if (highRiskUsers.length >= 3) {
      recommendations.push(
        'Критическая ситуация: несколько сотрудников с высоким риском перегрузки. Срочно требуется пересмотр распределения нагрузки.',
      );
    }

    // Individual recommendations
    for (const user of highRiskUsers) {
      recommendations.push(
        `${user.fullName} (${user.teamName}): прогноз ${user.predictedOvertime} ч переработок. Рекомендуется ограничить новые задачи и согласовать приоритеты.`,
      );
    }

    for (const user of medRiskUsers.slice(0, 3)) {
      const hours = user.predictedOvertime;
      recommendations.push(
        `${user.fullName} (${user.teamName}): прогноз ${hours} ч. Мониторинг нагрузки рекомендован.`,
      );
    }

    // General recommendations
    if (totalPredictedOvertime > 100) {
      recommendations.push(
        `Общий прогноз переработок: ${totalPredictedOvertime} ч на следующий месяц. Рекомендуется планирование ресурсов заранее.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Нагрузка в норме. Продолжайте мониторинг.');
    }

    // Period
    const forecastStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const forecastEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

    return {
      generatedAt: now.toISOString(),
      riskLevel: maxRiskLevel,
      predictedOvertimeHours: totalPredictedOvertime,
      overloadedUsers,
      recommendations,
      period: {
        start: forecastStart.toISOString(),
        end: forecastEnd.toISOString(),
      },
    };
  }
}
