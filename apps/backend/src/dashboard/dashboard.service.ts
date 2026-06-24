import { Injectable } from '@nestjs/common';
import { RequestStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { timeBalance: true, team: true, manager: true },
    });

    const isManager = user.role === Role.MANAGER || user.role === Role.ADMIN;
    const isLead = user.role === Role.LEAD;

    const requestsWhere = isManager
      ? { OR: [{ status: RequestStatus.PENDING }] }
      : isLead && user.teamId
        ? { OR: [{ userId }, { status: RequestStatus.PENDING, user: { teamId: user.teamId } }] }
        : { userId };

    const vacationsWhere = isManager
      ? { OR: [{ status: RequestStatus.PENDING }] }
      : isLead && user.teamId
        ? { OR: [{ userId }, { status: RequestStatus.PENDING, user: { teamId: user.teamId } }] }
        : { userId };

    const calendarWhere = isManager
      ? { status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] } }
      : isLead && user.teamId
        ? { status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] }, user: { teamId: user.teamId } }
        : { userId, status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] } };

    const [requests, vacations, teamCalendar, operations, notifications] = await Promise.all([
      this.prisma.timeOffRequest.findMany({
        where: requestsWhere,
        include: { user: true, approver: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.vacationRequest.findMany({
        where: vacationsWhere,
        include: { user: true, approver: true },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      this.prisma.timeOffRequest.findMany({
        where: calendarWhere,
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
