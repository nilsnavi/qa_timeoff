import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ────────────────────────────────────────────────────────

  private getDayType(date: Date): 'weekday' | 'weekend' | 'holiday' {
    const day = date.getDay();
    if (day === 0 || day === 6) return 'weekend';
    return 'weekday';
  }

  private getMultiplier(dayType: 'weekday' | 'weekend' | 'holiday'): number {
    switch (dayType) {
      case 'weekend': return 1.5;
      case 'holiday': return 2.0;
      default: return 1.0;
    }
  }

  private getDateFilter(startDate?: string, endDate?: string) {
    const now = new Date();
    return {
      gte: startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1),
      lte: endDate ? new Date(endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    };
  }

  // ── CSV Row Escaping ──────────────────────────────────────────────

  private escapeCsv(value: string | number | null | undefined): string {
    if (value == null) return '';
    const str = String(value);
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private toCsv(rows: string[][], bom = true): string {
    const content = rows.map((row) => row.join(';')).join('\r\n');
    return bom ? '\uFEFF' + content : content;
  }

  // ── Overtime Excel (as CSV with multiple sections) ────────────────

  async exportOvertimeCsv(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    userId?: string;
  }) {
    const dateFilter = this.getDateFilter(params?.startDate, params?.endDate);
    const where: Prisma.OvertimeWhereInput = {
      date: dateFilter,
      status: 'APPROVED',
      ...(params?.teamId ? { user: { teamId: params.teamId } } : {}),
      ...(params?.userId ? { userId: params.userId } : {}),
    };

    const overtimes = await this.prisma.overtime.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            position: true,
            hourlyRate: true,
            team: { select: { name: true } },
          },
        },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { date: 'asc' },
    });

    const rows: string[][] = [];
    // Header
    rows.push(['Дата', 'Сотрудник', 'Должность', 'Команда', 'Часы', 'Ставка', 'Коэффициент', 'Стоимость', 'Причина', 'Кто добавил']);

    for (const ot of overtimes) {
      const dayType = this.getDayType(ot.date);
      const multiplier = this.getMultiplier(dayType);
      const cost = ot.hours * ot.user.hourlyRate * multiplier;

      rows.push([
        ot.date.toISOString().split('T')[0],
        this.escapeCsv(ot.user.fullName),
        this.escapeCsv(ot.user.position ?? ''),
        this.escapeCsv(ot.user.team?.name ?? ''),
        String(ot.hours),
        String(ot.user.hourlyRate),
        String(multiplier),
        String(cost),
        this.escapeCsv(ot.reason),
        this.escapeCsv(ot.createdBy?.fullName ?? ''),
      ]);
    }

    return this.toCsv(rows);
  }

  // ── Payroll CSV ───────────────────────────────────────────────────

  async exportPayrollCsv(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    userId?: string;
  }) {
    const dateFilter = this.getDateFilter(params?.startDate, params?.endDate);
    const where: Prisma.OvertimeWhereInput = {
      date: dateFilter,
      status: 'APPROVED',
      ...(params?.teamId ? { user: { teamId: params.teamId } } : {}),
      ...(params?.userId ? { userId: params.userId } : {}),
    };

    const overtimes = await this.prisma.overtime.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, position: true, hourlyRate: true, team: { select: { name: true } } },
        },
      },
      orderBy: { date: 'asc' },
    });

    const rows: string[][] = [];
    rows.push(['Сотрудник', 'Должность', 'Команда', 'Всего часов', 'Ставка (₽/ч)', 'Общая стоимость']);

    const userMap = new Map<string, { fullName: string; position: string; teamName: string; hourlyRate: number; totalHours: number; totalCost: number }>();
    for (const ot of overtimes) {
      if (!userMap.has(ot.userId)) {
        userMap.set(ot.userId, {
          fullName: ot.user.fullName,
          position: ot.user.position ?? '',
          teamName: ot.user.team?.name ?? '',
          hourlyRate: ot.user.hourlyRate,
          totalHours: 0,
          totalCost: 0,
        });
      }
      const entry = userMap.get(ot.userId)!;
      const dayType = this.getDayType(ot.date);
      const multiplier = this.getMultiplier(dayType);
      entry.totalHours += ot.hours;
      entry.totalCost += ot.hours * ot.user.hourlyRate * multiplier;
    }

    for (const [_, entry] of userMap) {
      rows.push([
        this.escapeCsv(entry.fullName),
        this.escapeCsv(entry.position),
        this.escapeCsv(entry.teamName),
        String(entry.totalHours),
        String(entry.hourlyRate),
        String(entry.totalCost),
      ]);
    }

    return this.toCsv(rows);
  }

  // ── KPI CSV ───────────────────────────────────────────────────────

  async exportKpiCsv(params?: { month?: number; year?: number }) {
    const now = new Date();
    const targetMonth = params?.month ?? now.getMonth() + 1;
    const targetYear = params?.year ?? now.getFullYear();

    const kpis = await this.prisma.kpiPeriod.findMany({
      where: { month: targetMonth, year: targetYear },
      include: {
        user: {
          select: { id: true, fullName: true, position: true, team: { select: { name: true } } },
        },
      },
      orderBy: { kpiScore: 'desc' },
    });

    const rows: string[][] = [];
    rows.push(['Сотрудник', 'Должность', 'Команда', 'KPI Score', 'Надёжность', 'Нагрузка', 'Переработки (ч)', 'Одобрено', 'Отклонено', 'Отменено']);

    for (const kpi of kpis) {
      rows.push([
        this.escapeCsv(kpi.user.fullName),
        this.escapeCsv(kpi.user.position ?? ''),
        this.escapeCsv(kpi.user.team?.name ?? ''),
        String(kpi.kpiScore),
        String(kpi.reliabilityScore),
        String(kpi.workloadScore),
        String(kpi.overtimeHours),
        String(kpi.approvedRequests),
        String(kpi.rejectedRequests),
        String(kpi.cancelledRequests),
      ]);
    }

    return this.toCsv(rows);
  }

  // ── 1C Export ─────────────────────────────────────────────────────

  async export1cOvertimeCsv(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    userId?: string;
  }) {
    const dateFilter = this.getDateFilter(params?.startDate, params?.endDate);
    const where: Prisma.OvertimeWhereInput = {
      date: dateFilter,
      status: 'APPROVED',
      ...(params?.teamId ? { user: { teamId: params.teamId } } : {}),
      ...(params?.userId ? { userId: params.userId } : {}),
    };

    const overtimes = await this.prisma.overtime.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, position: true, hourlyRate: true },
        },
      },
      orderBy: [{ user: { fullName: 'asc' } }, { date: 'asc' }],
    });

    // 1C format: ТабельныйНомер;ФИО;Должность;Дата;Часы;Ставка;Коэффициент;Сумма;Комментарий
    const rows: string[][] = [];
    rows.push(['ТабельныйНомер', 'ФИО', 'Должность', 'Дата', 'Часы', 'Ставка', 'Коэффициент', 'Сумма', 'Комментарий']);

    let counter = 1;
    for (const ot of overtimes) {
      const dayType = this.getDayType(ot.date);
      const multiplier = this.getMultiplier(dayType);
      const cost = ot.hours * ot.user.hourlyRate * multiplier;

      rows.push([
        String(counter++),
        this.escapeCsv(ot.user.fullName),
        this.escapeCsv(ot.user.position ?? ''),
        ot.date.toISOString().split('T')[0],
        String(ot.hours),
        String(ot.user.hourlyRate),
        String(multiplier),
        String(cost),
        this.escapeCsv(ot.reason),
      ]);
    }

    return this.toCsv(rows);
  }

  async export1cPayrollCsv(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    userId?: string;
  }) {
    const dateFilter = this.getDateFilter(params?.startDate, params?.endDate);
    const where: Prisma.OvertimeWhereInput = {
      date: dateFilter,
      status: 'APPROVED',
      ...(params?.teamId ? { user: { teamId: params.teamId } } : {}),
      ...(params?.userId ? { userId: params.userId } : {}),
    };

    const overtimes = await this.prisma.overtime.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, position: true, hourlyRate: true },
        },
      },
      orderBy: [{ user: { fullName: 'asc' } }, { date: 'asc' }],
    });

    // 1C payroll format: ТабельныйНомер;ФИО;Должность;ВсегоЧасов;Ставка;ОбщаяСумма
    const userMap = new Map<string, { fullName: string; position: string; hourlyRate: number; totalHours: number; totalCost: number }>();
    for (const ot of overtimes) {
      if (!userMap.has(ot.userId)) {
        userMap.set(ot.userId, {
          fullName: ot.user.fullName,
          position: ot.user.position ?? '',
          hourlyRate: ot.user.hourlyRate,
          totalHours: 0,
          totalCost: 0,
        });
      }
      const entry = userMap.get(ot.userId)!;
      const multiplier = this.getMultiplier(this.getDayType(ot.date));
      entry.totalHours += ot.hours;
      entry.totalCost += ot.hours * ot.user.hourlyRate * multiplier;
    }

    const rows: string[][] = [];
    rows.push(['ТабельныйНомер', 'ФИО', 'Должность', 'ВсегоЧасов', 'Ставка', 'ОбщаяСумма']);

    let counter = 1;
    for (const [_, entry] of userMap) {
      rows.push([
        String(counter++),
        this.escapeCsv(entry.fullName),
        this.escapeCsv(entry.position),
        String(entry.totalHours),
        String(entry.hourlyRate),
        String(entry.totalCost),
      ]);
    }

    return this.toCsv(rows);
  }
}
