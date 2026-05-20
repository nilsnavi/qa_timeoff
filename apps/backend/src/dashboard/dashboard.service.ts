import { Injectable } from '@nestjs/common';
import { RequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { timeBalance: true, team: true, manager: true },
    });

    const [requests, vacations, teamCalendar, operations, notifications] = await Promise.all([
      this.prisma.timeOffRequest.findMany({
        where: { OR: [{ userId }, { status: RequestStatus.PENDING }] },
        include: { user: true, approver: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.vacationRequest.findMany({
        where: { OR: [{ userId }, { status: RequestStatus.PENDING }] },
        include: { user: true, approver: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.timeOffRequest.findMany({
        where: { status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] } },
        include: { user: true, approver: true },
        orderBy: { date: 'asc' },
        take: 60,
      }),
      this.prisma.balanceOperation.findMany({
        where: { userId },
        include: { createdBy: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    return {
      user,
      balance: user.timeBalance ?? { balanceHours: 0, totalAddedHours: 0, totalUsedHours: 0 },
      requests,
      vacations,
      teamCalendar,
      operations,
      notifications,
    };
  }
}
