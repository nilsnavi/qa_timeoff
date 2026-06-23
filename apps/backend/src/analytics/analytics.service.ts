import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkload(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
  }) {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const startDate = params?.startDate ? new Date(params.startDate) : defaultStart;
    const endDate = params?.endDate ? new Date(params.endDate) : defaultEnd;

    // ── Workload by Day ──────────────────────────────────────────────
    const overtimeWhere: Prisma.OvertimeWhereInput = {
      date: { gte: startDate, lte: endDate },
      status: 'APPROVED',
    };
    if (params?.teamId) {
      overtimeWhere.user = { teamId: params.teamId };
    }

    const overtimes = await this.prisma.overtime.findMany({
      where: overtimeWhere,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            teamId: true,
            team: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Workload by day
    const dayMap = new Map<string, number>();
    for (const ot of overtimes) {
      const key = ot.date.toISOString().split('T')[0];
      dayMap.set(key, (dayMap.get(key) ?? 0) + ot.hours);
    }
    const workloadByDay = Array.from(dayMap.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Workload by user
    const userMap = new Map<string, { fullName: string; totalHours: number }>();
    for (const ot of overtimes) {
      if (!userMap.has(ot.userId)) {
        userMap.set(ot.userId, { fullName: ot.user.fullName, totalHours: 0 });
      }
      userMap.get(ot.userId)!.totalHours += ot.hours;
    }
    const workloadByUser = Array.from(userMap.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.totalHours - a.totalHours);

    // Workload by team
    const teamMap = new Map<string, { teamName: string; totalHours: number }>();
    for (const ot of overtimes) {
      const teamName = ot.user.team?.name ?? 'Без отдела';
      if (!teamMap.has(teamName)) {
        teamMap.set(teamName, { teamName, totalHours: 0 });
      }
      teamMap.get(teamName)!.totalHours += ot.hours;
    }
    const workloadByTeam = Array.from(teamMap.entries())
      .map(([_, data]) => data)
      .sort((a, b) => b.totalHours - a.totalHours);

    // Overtime trend (monthly aggregation)
    const trendMap = new Map<string, number>();
    for (const ot of overtimes) {
      const key = `${ot.date.getFullYear()}-${String(ot.date.getMonth() + 1).padStart(2, '0')}`;
      trendMap.set(key, (trendMap.get(key) ?? 0) + ot.hours);
    }
    const overtimeTrend = Array.from(trendMap.entries())
      .map(([month, hours]) => ({ month, hours }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Absence trend
    const absenceWhere: Prisma.TimeOffRequestWhereInput = {
      date: { gte: startDate, lte: endDate },
      status: { in: ['APPROVED', 'PENDING'] },
    };
    if (params?.teamId) {
      absenceWhere.user = { teamId: params.teamId };
    }
    const absences = await this.prisma.timeOffRequest.findMany({
      where: absenceWhere,
      select: { date: true, hours: true },
    });

    const absenceDayMap = new Map<string, number>();
    for (const a of absences) {
      const key = a.date.toISOString().split('T')[0];
      absenceDayMap.set(key, (absenceDayMap.get(key) ?? 0) + a.hours);
    }
    const absenceTrend = Array.from(absenceDayMap.entries())
      .map(([date, hours]) => ({ date, hours }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Top overloaded users (top 5)
    const topOverloaded = workloadByUser.slice(0, 5);

    return {
      workloadByDay,
      workloadByUser,
      workloadByTeam,
      overtimeTrend,
      absenceTrend,
      topOverloaded,
    };
  }
}
