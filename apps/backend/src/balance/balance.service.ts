import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BalanceOperationType, Prisma, Role, User } from '@prisma/client';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceOperationDto } from './dto/balance-operation.dto';

export interface BalanceHistoryEntry {
  date: string;
  balance: number;
  accrued: number;
  used: number;
}

export interface BalanceLedgerEntry {
  id: string;
  type: 'overtime' | 'leave' | 'adjustment';
  value: number; // positive = added, negative = deducted
  status: 'pending' | 'approved';
  createdBy: string;
  timestamp: string;
  comment: string;
}

export interface BalanceLedgerResponse {
  items: BalanceLedgerEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface BalanceSummaryResponse {
  accruedHours: number;
  usedHours: number;
  overtimeMultiplier: number;
  pendingRequests: number;
  overtimeHours: number;
  leaveHours: number;
}

const balanceInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      teamId: true,
    },
  },
} satisfies Prisma.TimeBalanceInclude;

const operationInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      teamId: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
    },
  },
} satisfies Prisma.BalanceOperationInclude;

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  getMyBalance(userId: string) {
    return this.ensureBalance(userId);
  }

  async getUserBalance(currentUser: User, userId: string) {
    await this.assertCanAccessUser(currentUser, userId);
    return this.ensureBalance(userId);
  }

  async add(currentUser: User, dto: BalanceOperationDto) {
    await this.assertUserExists(dto.userId);

    return this.prisma.$transaction(async (tx) => {
      const balance = await tx.timeBalance.upsert({
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
        include: balanceInclude,
      });

      await tx.balanceOperation.create({
        data: {
          userId: dto.userId,
          operationType: BalanceOperationType.ADD,
          hours: dto.hours,
          reason: dto.reason,
          createdById: currentUser.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: dto.userId,
          title: 'Баланс обновлён',
          message: `Начислено ${dto.hours} ч`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });

      return balance;
    });
  }

  async writeOff(currentUser: User, dto: BalanceOperationDto) {
    await this.assertUserExists(dto.userId);

    return this.prisma.$transaction(async (tx) => {
      const currentBalance = await tx.timeBalance.upsert({
        where: { userId: dto.userId },
        create: { userId: dto.userId },
        update: {},
      });

      if (currentBalance.balanceHours < dto.hours) {
        throw new BadRequestException('Insufficient balance hours');
      }

      const balance = await tx.timeBalance.update({
        where: { userId: dto.userId },
        data: {
          balanceHours: { decrement: dto.hours },
          totalUsedHours: { increment: dto.hours },
        },
        include: balanceInclude,
      });

      await tx.balanceOperation.create({
        data: {
          userId: dto.userId,
          operationType: BalanceOperationType.WRITE_OFF,
          hours: -dto.hours,
          reason: dto.reason,
          createdById: currentUser.id,
        },
      });

      await tx.notification.create({
        data: {
          userId: dto.userId,
          title: 'Баланс обновлён',
          message: `Списано ${dto.hours} ч с баланса`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });

      return balance;
    });
  }

  getOperations(currentUser: User) {
    return this.prisma.balanceOperation.findMany({
      where: this.buildOperationsVisibilityWhere(currentUser),
      include: operationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserOperations(currentUser: User, userId: string) {
    await this.assertCanAccessUser(currentUser, userId);

    return this.prisma.balanceOperation.findMany({
      where: { userId },
      include: operationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async writeOffForApprovedTimeOff(userId: string, hours: number, reason: string, createdById: string) {
    return this.prisma.$transaction(async (tx) => {
      const currentBalance = await tx.timeBalance.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });

      if (currentBalance.balanceHours < hours) {
        throw new BadRequestException('Insufficient balance hours');
      }

      const balance = await tx.timeBalance.update({
        where: { userId },
        data: {
          balanceHours: { decrement: hours },
          totalUsedHours: { increment: hours },
        },
      });

      await tx.balanceOperation.create({
        data: {
          userId,
          operationType: BalanceOperationType.WRITE_OFF,
          hours: -hours,
          reason,
          createdById,
        },
      });

      return balance;
    });
  }

  // ── Balance History ──────────────────────────────────────────────
  async getBalanceHistory(userId: string, days = 30): Promise<BalanceHistoryEntry[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const operations = await this.prisma.balanceOperation.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    // Build daily snapshots
    const dailyMap = new Map<string, { accrued: number; used: number }>();
    for (const op of operations) {
      const dayKey = op.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(dayKey) ?? { accrued: 0, used: 0 };
      if (op.hours > 0) entry.accrued += op.hours;
      else entry.used += Math.abs(op.hours);
      dailyMap.set(dayKey, entry);
    }

    // Fill all days in range
    const result: BalanceHistoryEntry[] = [];

    // Get balance at start of period
    const opsBefore = await this.prisma.balanceOperation.findMany({
      where: { userId, createdAt: { lt: since } },
      select: { hours: true },
    });
    let runningBalance = 0;
    for (const op of opsBefore) runningBalance += op.hours;
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const dayKey = d.toISOString().slice(0, 10);
      const dayData = dailyMap.get(dayKey);
      if (dayData) {
        runningBalance += dayData.accrued - dayData.used;
      }
      result.push({
        date: dayKey,
        balance: runningBalance,
        accrued: dayData?.accrued ?? 0,
        used: dayData?.used ?? 0,
      });
    }

    return result;
  }

  // ── Balance Ledger ───────────────────────────────────────────────
  async getBalanceLedger(userId: string, page = 1, limit = 50): Promise<BalanceLedgerResponse> {
    const skip = (page - 1) * limit;

    const [operations, total] = await Promise.all([
      this.prisma.balanceOperation.findMany({
        where: { userId },
        include: { createdBy: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.balanceOperation.count({ where: { userId } }),
    ]);

    const items: BalanceLedgerEntry[] = operations.map((op) => ({
      id: op.id,
      type: op.operationType === 'ADD' ? 'overtime' as const
        : op.operationType === 'WRITE_OFF' ? 'leave' as const
        : 'adjustment' as const,
      value: op.hours,
      status: 'approved' as const,
      createdBy: op.createdBy?.fullName ?? 'System',
      timestamp: op.createdAt.toISOString(),
      comment: op.reason,
    }));

    return { items, total, page, limit };
  }

  // ── Balance Summary ──────────────────────────────────────────────
  async getBalanceSummary(userId: string): Promise<BalanceSummaryResponse> {
    const balance = await this.ensureBalance(userId);

    // Count pending requests
    const [pendingTimeOff, pendingVacations] = await Promise.all([
      this.prisma.timeOffRequest.count({ where: { userId, status: 'PENDING' as any } }),
      this.prisma.vacationRequest.count({ where: { userId, status: 'PENDING' as any } }),
    ]);

    // Get overtime hours (approved)
    const overtimeAgg = await this.prisma.overtime.aggregate({
      where: { userId, status: 'APPROVED' as any },
      _sum: { hours: true },
    });

    // Get leave hours (approved time off + vacation days)
    const timeOffAgg = await this.prisma.timeOffRequest.aggregate({
      where: { userId, status: 'APPROVED' as any },
      _sum: { hours: true },
    });
    const vacationAgg = await this.prisma.vacationRequest.aggregate({
      where: { userId, status: 'APPROVED' as any },
      _sum: { daysCount: true },
    });

    return {
      accruedHours: balance.totalAddedHours,
      usedHours: balance.totalUsedHours,
      overtimeMultiplier: 1.5,
      pendingRequests: pendingTimeOff + pendingVacations,
      overtimeHours: overtimeAgg._sum.hours ?? 0,
      leaveHours: (timeOffAgg._sum.hours ?? 0) + (vacationAgg._sum.daysCount ?? 0) * 8,
    };
  }

  private async ensureBalance(userId: string) {
    await this.assertUserExists(userId);

    return this.prisma.timeBalance.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: balanceInclude,
    });
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async assertCanAccessUser(currentUser: User, userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, teamId: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (!this.canAccessUser(currentUser, target)) {
      throw new ForbiddenException('You cannot access this user balance');
    }
  }

  private buildOperationsVisibilityWhere(currentUser: User): Prisma.BalanceOperationWhereInput {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return {};
    }

    if (currentUser.role === Role.LEAD) {
      return currentUser.teamId ? { user: { teamId: currentUser.teamId } } : { userId: currentUser.id };
    }

    return { userId: currentUser.id };
  }

  private canAccessUser(currentUser: User, target: { id: string; teamId: string | null }) {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return true;
    }

    if (currentUser.role === Role.LEAD) {
      return !!currentUser.teamId && currentUser.teamId === target.teamId;
    }

    return currentUser.id === target.id;
  }
}
