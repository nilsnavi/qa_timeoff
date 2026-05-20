import { Injectable } from '@nestjs/common';
import { BalanceOperationType } from '@prisma/client';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  accrue(userId: string, hours: number, comment: string) {
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
        data: { userId, operationType: BalanceOperationType.ADD, hours, reason: comment, createdById: userId },
      });
      await tx.notification.create({
        data: {
          userId,
          title: 'Hours accrued',
          message: `${hours} hours added to your balance`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });
      return balance;
    });
  }

  writeOff(userId: string, hours: number, comment: string) {
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
        data: { userId, operationType: BalanceOperationType.WRITE_OFF, hours: -hours, reason: comment, createdById: userId },
      });
      await tx.notification.create({
        data: {
          userId,
          title: 'Hours written off',
          message: `${hours} hours were written off`,
          type: NotificationType.BALANCE_CHANGED,
        },
      });
      return balance;
    });
  }
}
