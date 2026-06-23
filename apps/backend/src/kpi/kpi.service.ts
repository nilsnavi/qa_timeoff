import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(params?: {
    userId?: string;
    month?: number;
    year?: number;
    limit?: number;
    offset?: number;
  }) {
    const where: Prisma.KpiPeriodWhereInput = {};
    if (params?.userId) where.userId = params.userId;
    if (params?.month) where.month = params.month;
    if (params?.year) where.year = params.year;

    const [items, total] = await Promise.all([
      this.prisma.kpiPeriod.findMany({
        where,
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: params?.limit ?? 50,
        skip: params?.offset ?? 0,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              position: true,
              team: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.kpiPeriod.count({ where }),
    ]);

    return { items, total };
  }

  async findByUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.kpiPeriod.findMany({
      where: { userId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async recalculate(userId?: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-based

    const where: Prisma.UserWhereInput = {
      isActive: true,
      ...(userId ? { id: userId } : {}),
    };

    const users = await this.prisma.user.findMany({ where, select: { id: true, fullName: true } });
    const results: Array<{ userId: string; fullName: string; kpiScore: number }> = [];

    for (const user of users) {
      const kpi = await this.calculateKpi(user.id, currentMonth, currentYear);

      const upserted = await this.prisma.kpiPeriod.upsert({
        where: {
          userId_month_year: { userId: user.id, month: currentMonth, year: currentYear },
        },
        create: kpi,
        update: kpi,
      });

      results.push({ userId: user.id, fullName: user.fullName, kpiScore: upserted.kpiScore });
    }

    return { results, period: { month: currentMonth, year: currentYear } };
  }

  private async calculateKpi(userId: string, month: number, year: number) {
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Get overtime data for the period
    const overtimeAgg = await this.prisma.overtime.aggregate({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth },
        status: 'APPROVED',
      },
      _sum: { hours: true },
    });
    const overtimeHours = overtimeAgg._sum.hours ?? 0;

    // Get request stats
    const approvedRequests = await this.prisma.timeOffRequest.count({
      where: { userId, status: 'APPROVED', createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });
    const rejectedRequests = await this.prisma.timeOffRequest.count({
      where: { userId, status: 'REJECTED', createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });
    const cancelledRequests = await this.prisma.timeOffRequest.count({
      where: { userId, status: 'CANCELLED', createdAt: { gte: startOfMonth, lte: endOfMonth } },
    });

    const totalRequests = approvedRequests + rejectedRequests + cancelledRequests;

    // Workload score: based on overtime hours (0-100 scale)
    // 0 overtime = 100, 20+ overtime = 0
    const workloadScore = Math.max(0, 100 - overtimeHours * 5);

    // Reliability score: fewer cancellations/rejections = higher
    // Base 100, -10 per rejection/cancellation
    const reliabilityScore = Math.max(0, 100 - (rejectedRequests + cancelledRequests) * 10);

    // Approval quality score: % of approved vs total
    const approvalQualityScore = totalRequests > 0
      ? Math.round((approvedRequests / totalRequests) * 100)
      : 100;

    // Overtime balance score: moderate overtime is good, too much is bad
    const overtimeBalanceScore = overtimeHours <= 4 ? 100
      : overtimeHours <= 8 ? 80
      : overtimeHours <= 12 ? 60
      : overtimeHours <= 20 ? 40
      : 20;

    // Final KPI score (weighted)
    const kpiScore = Math.round(
      reliabilityScore * 0.4 +
      workloadScore * 0.3 +
      approvalQualityScore * 0.2 +
      overtimeBalanceScore * 0.1
    );

    return {
      userId,
      month,
      year,
      plannedHours: 160, // Default planned hours
      actualWorkedHours: 160 + overtimeHours,
      overtimeHours,
      approvedRequests,
      rejectedRequests,
      cancelledRequests,
      responseTimeAvgHours: 0,
      workloadScore,
      reliabilityScore,
      kpiScore: Math.min(100, Math.max(0, kpiScore)),
    };
  }
}
