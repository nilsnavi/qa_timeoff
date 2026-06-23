import { Injectable } from '@nestjs/common';
import { BalanceOperationType, User } from '@prisma/client';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
}
