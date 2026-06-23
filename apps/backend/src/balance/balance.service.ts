import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BalanceOperationType, Prisma, Role, User } from '@prisma/client';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceOperationDto } from './dto/balance-operation.dto';

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
