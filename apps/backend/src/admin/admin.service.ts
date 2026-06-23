import { Injectable, NotFoundException } from '@nestjs/common';
import { BalanceOperationType, OvertimeStatus, Prisma, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { NotificationType } from '../notifications/notification-types';
import { AdminTelegramNotifier } from '../notifications/admin-telegram-notifier.service';
import { TelegramNotificationService } from '../notifications/telegram-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { UpdateHourlyRateDto } from './dto/update-hourly-rate.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

const userSelect = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  position: true,
  hourlyRate: true,
  role: true,
  teamId: true,
  isActive: true,
  telegramId: true,
  team: { select: { id: true, name: true } },
  timeBalance: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramNotification: TelegramNotificationService,
    private readonly adminNotifier: AdminTelegramNotifier,
    private readonly auditService: AuditService,
  ) {}

  // ── Balance Operations (existing) ──────────────────────────────────

  accrue(currentUser: User, userId: string, hours: number, comment: string) {
    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.timeBalance.upsert({
        where: { userId },
        create: { userId, balanceHours: hours, totalAddedHours: hours },
        update: {
          balanceHours: { increment: hours },
          totalAddedHours: { increment: hours },
        },
      });
      await tx.balanceOperation.create({
        data: { userId, operationType: BalanceOperationType.ADD, hours, reason: comment, createdById: currentUser.id },
      });
      await tx.notification.create({
        data: {
          userId,
          title: 'Часы начислены',
          message: `На баланс добавлено ${hours} ч`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });
      return balance;
    });
  }

  writeOff(currentUser: User, userId: string, hours: number, comment: string) {
    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.timeBalance.upsert({
        where: { userId },
        create: { userId, balanceHours: -hours, totalUsedHours: hours },
        update: {
          balanceHours: { decrement: hours },
          totalUsedHours: { increment: hours },
        },
      });
      await tx.balanceOperation.create({
        data: { userId, operationType: BalanceOperationType.WRITE_OFF, hours: -hours, reason: comment, createdById: currentUser.id },
      });
      await tx.notification.create({
        data: {
          userId,
          title: 'Часы списаны',
          message: `С баланса списано ${hours} ч`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });
      return balance;
    });
  }

  // ── Position Management ────────────────────────────────────────────

  async updatePosition(admin: User, userId: string, dto: UpdatePositionDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldPosition = user.position;
    const newPosition = dto.position;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { position: newPosition },
        select: userSelect,
      });

      await tx.positionHistory.create({
        data: {
          userId,
          position: newPosition,
          changedBy: admin.id,
        },
      });

      await tx.notification.create({
        data: {
          userId,
          title: 'Должность изменена',
          message: `Ваша должность изменена: "${oldPosition ?? 'не указана'}" → "${newPosition}"`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });

      return updated;
    });

    // Telegram notifications (non-blocking)
    this.telegramNotification.notifyPositionChange(user.telegramId, oldPosition, newPosition).catch(() => {});
    this.adminNotifier.notifyPositionChanged(admin.fullName, user.fullName, oldPosition, newPosition).catch(() => {});

    return result;
  }

  async getPositionHistory(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.positionHistory.findMany({
      where: { userId },
      orderBy: { changedAt: 'desc' },
      include: {
        changer: {
          select: { id: true, fullName: true },
        },
      },
    });
  }

  // ── Overtime Management ────────────────────────────────────────────

  async addOvertime(admin: User, dto: CreateOvertimeDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Create overtime record
      const overtime = await tx.overtime.create({
        data: {
          userId: dto.userId,
          hours: dto.hours,
          date: new Date(dto.date),
          reason: dto.reason,
          createdById: admin.id,
        },
        include: {
          user: { select: { id: true, fullName: true, telegramId: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });

      // Update TimeBalance
      await tx.timeBalance.upsert({
        where: { userId: dto.userId },
        create: {
          userId: dto.userId,
          balanceHours: dto.hours,
          totalAddedHours: dto.hours,
        },
        update: {
          balanceHours: { increment: dto.hours },
          totalAddedHours: { increment: dto.hours },
        },
      });

      // In-app notification
      await tx.notification.create({
        data: {
          userId: dto.userId,
          title: 'Переработка добавлена',
          message: `Добавлено ${dto.hours} ч переработки: ${dto.reason}`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });

      return overtime;
    });

    // Telegram notifications (non-blocking)
    this.adminNotifier.notifyOvertimeAdded(user.fullName, dto.hours, dto.reason).catch(() => {});

    // Check for critical overtime (>20h/month)
    this.checkCriticalOvertime(dto.userId, user.fullName).catch(() => {});

    return result;
  }

  private async checkCriticalOvertime(userId: string, fullName: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthlyOvertime = await this.prisma.overtime.aggregate({
      where: {
        userId,
        date: { gte: startOfMonth },
      },
      _sum: { hours: true },
    });

    const totalHours = monthlyOvertime._sum.hours ?? 0;
    if (totalHours > 20) {
      const monthName = now.toLocaleString('ru-RU', { month: 'long' });
      await this.adminNotifier.notifyCriticalOvertime(fullName, totalHours, monthName);
    }
  }

  async getUserOvertime(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.overtime.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async getOvertimeCalendar(
    userId?: string,
    teamId?: string,
    year?: number,
    month?: number,
  ) {
    const now = new Date();
    const targetYear = year ?? now.getFullYear();
    const targetMonth = month ?? now.getMonth() + 1; // 1-based

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

    const where: Prisma.OvertimeWhereInput = {
      date: { gte: startDate, lte: endDate },
    };

    if (userId) {
      where.userId = userId;
    }

    if (teamId) {
      where.user = { teamId };
    }

    const overtimes = await this.prisma.overtime.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        user: {
          select: { id: true, fullName: true, telegramId: true, team: { select: { id: true, name: true } } },
        },
      },
    });

    // Group by date and user for calendar display
    const calendarMap = new Map<string, { hours: number; records: typeof overtimes }>();

    for (const ot of overtimes) {
      const dateKey = ot.date.toISOString().split('T')[0];
      const userKey = `${dateKey}_${ot.userId}`;

      if (!calendarMap.has(userKey)) {
        calendarMap.set(userKey, { hours: 0, records: [] });
      }

      const entry = calendarMap.get(userKey)!;
      entry.hours += ot.hours;
      entry.records.push(ot);
    }

    // Convert to array with color coding
    const calendarData = Array.from(calendarMap.entries()).map(([key, entry]) => {
      const [dateStr] = key.split('_');
      // Color coding: <4h = green, 4-8h = orange, >8h = red
      let color: string;
      if (entry.hours <= 4) {
        color = '#22c55e'; // green - normal
      } else if (entry.hours <= 8) {
        color = '#f97316'; // orange - overtime
      } else {
        color = '#ef4444'; // red - overload
      }

      return {
        date: dateStr,
        userId: entry.records[0].userId,
        userName: entry.records[0].user.fullName,
        team: entry.records[0].user.team,
        totalHours: entry.hours,
        color,
        records: entry.records,
      };
    });

    return calendarData;
  }

  // ── Reports ────────────────────────────────────────────────────────

  async getOvertimeReport(startDate?: string, endDate?: string) {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const where: Prisma.OvertimeWhereInput = {
      date: {
        gte: startDate ? new Date(startDate) : defaultStart,
        lte: endDate ? new Date(endDate) : defaultEnd,
      },
    };

    const overtimes = await this.prisma.overtime.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            telegramId: true,
            team: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Group by department, then by user
    const departmentMap = new Map<string, Map<string, { fullName: string; totalHours: number; records: typeof overtimes }>>();

    for (const ot of overtimes) {
      const deptName = ot.user.team?.name ?? 'Без отдела';
      if (!departmentMap.has(deptName)) {
        departmentMap.set(deptName, new Map());
      }

      const userMap = departmentMap.get(deptName)!;
      if (!userMap.has(ot.userId)) {
        userMap.set(ot.userId, { fullName: ot.user.fullName, totalHours: 0, records: [] });
      }

      const entry = userMap.get(ot.userId)!;
      entry.totalHours += ot.hours;
      entry.records.push(ot);
    }

    // Build report
    const report: Array<{
      department: string;
      users: Array<{ userId: string; fullName: string; totalHours: number }>;
      departmentTotal: number;
    }> = [];

    for (const [dept, userMap] of departmentMap.entries()) {
      const users = Array.from(userMap.entries())
        .map(([userId, data]) => ({
          userId,
          fullName: data.fullName,
          totalHours: data.totalHours,
        }))
        .sort((a, b) => b.totalHours - a.totalHours); // top users first

      const departmentTotal = users.reduce((sum, u) => sum + u.totalHours, 0);

      report.push({
        department: dept,
        users,
        departmentTotal,
      });
    }

    // Sort departments by total hours descending
    report.sort((a, b) => b.departmentTotal - a.departmentTotal);

    // Top employees overall
    const topEmployees = Array.from(
      new Map(overtimes.map((ot) => [ot.userId, ot])).keys(),
    )
      .map((userId) => {
        const userOvertimes = overtimes.filter((ot) => ot.userId === userId);
        const totalHours = userOvertimes.reduce((sum, ot) => sum + ot.hours, 0);
        return {
          userId,
          fullName: userOvertimes[0].user.fullName,
          teamName: userOvertimes[0].user.team?.name ?? 'Без отдела',
          totalHours,
        };
      })
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 10);

    return {
      departments: report,
      topEmployees,
      totalOvertimeHours: overtimes.reduce((sum, ot) => sum + ot.hours, 0),
      period: {
        start: startDate ?? defaultStart.toISOString(),
        end: endDate ?? defaultEnd.toISOString(),
      },
    };
  }

  async getPayrollReport(startDate?: string, endDate?: string) {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const where: Prisma.OvertimeWhereInput = {
      date: {
        gte: startDate ? new Date(startDate) : defaultStart,
        lte: endDate ? new Date(endDate) : defaultEnd,
      },
    };

    const overtimes = await this.prisma.overtime.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            hourlyRate: true,
            telegramId: true,
            team: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate cost per overtime record
    const getDayType = (date: Date): 'weekday' | 'weekend' | 'holiday' => {
      const day = date.getDay();
      if (day === 0 || day === 6) return 'weekend';
      // Simple holiday check (can be extended)
      return 'weekday';
    };

    const getMultiplier = (dayType: 'weekday' | 'weekend' | 'holiday'): number => {
      switch (dayType) {
        case 'weekend':
          return 1.5;
        case 'holiday':
          return 2.0;
        default:
          return 1.0;
      }
    };

    // Group by user
    const userPayrollMap = new Map<
      string,
      {
        fullName: string;
        hourlyRate: number;
        teamName: string;
        totalHours: number;
        totalCost: number;
        details: Array<{
          date: string;
          hours: number;
          dayType: string;
          multiplier: number;
          cost: number;
        }>;
      }
    >();

    for (const ot of overtimes) {
      if (!userPayrollMap.has(ot.userId)) {
        userPayrollMap.set(ot.userId, {
          fullName: ot.user.fullName,
          hourlyRate: ot.user.hourlyRate,
          teamName: ot.user.team?.name ?? 'Без отдела',
          totalHours: 0,
          totalCost: 0,
          details: [],
        });
      }

      const entry = userPayrollMap.get(ot.userId)!;
      const dayType = getDayType(ot.date);
      const multiplier = getMultiplier(dayType);
      const cost = ot.hours * ot.user.hourlyRate * multiplier;

      entry.totalHours += ot.hours;
      entry.totalCost += cost;
      entry.details.push({
        date: ot.date.toISOString().split('T')[0],
        hours: ot.hours,
        dayType,
        multiplier,
        cost,
      });
    }

    const employees = Array.from(userPayrollMap.entries())
      .map(([userId, data]) => ({
        userId,
        ...data,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    const grandTotal = employees.reduce((sum, e) => sum + e.totalCost, 0);

    return {
      employees,
      grandTotal,
      period: {
        start: startDate ?? defaultStart.toISOString(),
        end: endDate ?? defaultEnd.toISOString(),
      },
    };
  }

  // ── Hourly Rate ───────────────────────────────────────────────────

  async updateHourlyRate(admin: User, userId: string, dto: UpdateHourlyRateDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldRate = user.hourlyRate;
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: {
        hourlyRate: dto.hourlyRate,
        ...(dto.currency ? { currency: dto.currency } : {}),
      },
      select: userSelect,
    });

    await this.auditService.log({
      actorId: admin.id,
      action: 'UPDATE_HOURLY_RATE',
      entityType: 'User',
      entityId: userId,
      payload: { oldRate, newRate: dto.hourlyRate, oldCurrency: user.currency, newCurrency: dto.currency },
    });

    // Telegram notification
    if (user.telegramId) {
      this.telegramNotification
        .sendMessage(user.telegramId, `💰 <b>Изменение ставки</b>\n\nВаша почасовая ставка изменена: ${oldRate} ₽ → ${dto.hourlyRate} ₽/ч`)
        .catch(() => {});
    }

    return result;
  }

  // ── Overtime Management (new) ─────────────────────────────────────

  async getAllOvertime(params?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    userId?: string;
  }) {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const where: Prisma.OvertimeWhereInput = {
      date: {
        gte: params?.startDate ? new Date(params.startDate) : defaultStart,
        lte: params?.endDate ? new Date(params.endDate) : defaultEnd,
      },
    };
    if (params?.teamId) where.user = { teamId: params.teamId };
    if (params?.userId) where.userId = params.userId;

    return this.prisma.overtime.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, team: { select: { name: true } } } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async cancelOvertime(admin: User, overtimeId: string) {
    const overtime = await this.prisma.overtime.findUnique({
      where: { id: overtimeId },
      include: { user: { select: { id: true, fullName: true, telegramId: true } } },
    });

    if (!overtime) {
      throw new NotFoundException('Overtime record not found');
    }

    if (overtime.status === OvertimeStatus.CANCELLED) {
      throw new NotFoundException('Overtime already cancelled');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.overtime.update({
        where: { id: overtimeId },
        data: {
          status: OvertimeStatus.CANCELLED,
          cancelledById: admin.id,
          cancelledAt: new Date(),
        },
      });

      // Rollback TimeBalance
      await tx.timeBalance.upsert({
        where: { userId: overtime.userId },
        create: {
          userId: overtime.userId,
          balanceHours: 0,
          totalAddedHours: 0,
        },
        update: {
          balanceHours: { decrement: overtime.hours },
          totalAddedHours: { decrement: overtime.hours },
        },
      });

      await tx.notification.create({
        data: {
          userId: overtime.userId,
          title: 'Переработка отменена',
          message: `Переработка на ${overtime.hours} ч (${overtime.reason}) отменена`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });

      return updated;
    });

    // Audit log
    await this.auditService.log({
      actorId: admin.id,
      action: 'CANCEL_OVERTIME',
      entityType: 'Overtime',
      entityId: overtimeId,
      payload: { userId: overtime.userId, hours: overtime.hours, reason: overtime.reason },
    });

    // Telegram notification
    if (overtime.user.telegramId) {
      this.telegramNotification
        .sendMessage(
          overtime.user.telegramId,
          `❌ <b>Переработка отменена</b>\n\n${overtime.hours} ч (${overtime.reason}) отменены администратором.`,
        )
        .catch(() => {});
    }

    return result;
  }

  // ── Audit Log ─────────────────────────────────────────────────────

  async getAuditLog(params?: { entityType?: string; entityId?: string }) {
    return this.auditService.findAll({
      entityType: params?.entityType,
      entityId: params?.entityId,
      limit: 100,
    });
  }
}
