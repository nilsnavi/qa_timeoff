import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RequestStatus, Role, TimeOffRequest, User, VacationRequest } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AbsenceType = 'TIME_OFF' | 'VACATION';

const employeeSelect = {
  id: true,
  fullName: true,
  username: true,
  email: true,
  position: true,
  role: true,
  teamId: true,
} satisfies Prisma.UserSelect;

type EventUser = Pick<User, 'id' | 'fullName' | 'username' | 'email' | 'position' | 'role' | 'teamId'>;
type TimeOffWithUser = TimeOffRequest & { user: EventUser };
type VacationWithUser = VacationRequest & { user: EventUser };

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getCalendar(currentUser: User) {
    return this.buildCalendar(this.buildVisibilityWhere(currentUser));
  }

  async getTeamCalendar(currentUser: User, teamId: string) {
    await this.assertCanSeeTeam(currentUser, teamId);
    return this.buildCalendar({ user: { teamId } });
  }

  async getUserCalendar(currentUser: User, userId: string) {
    await this.assertCanSeeUser(currentUser, userId);
    return this.buildCalendar({ userId });
  }

  private async buildCalendar(scopeWhere: Prisma.TimeOffRequestWhereInput) {
    const vacationScopeWhere = scopeWhere as Prisma.VacationRequestWhereInput;

    const [approvedTimeOff, approvedVacations, pendingTimeOff, pendingVacations] = await Promise.all([
      this.prisma.timeOffRequest.findMany({
        where: {
          ...scopeWhere,
          status: RequestStatus.APPROVED,
        },
        include: { user: { select: employeeSelect } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.vacationRequest.findMany({
        where: {
          ...vacationScopeWhere,
          status: RequestStatus.APPROVED,
        },
        include: { user: { select: employeeSelect } },
        orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.timeOffRequest.findMany({
        where: {
          ...scopeWhere,
          status: RequestStatus.PENDING,
        },
        include: { user: { select: employeeSelect } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.vacationRequest.findMany({
        where: {
          ...vacationScopeWhere,
          status: RequestStatus.PENDING,
        },
        include: { user: { select: employeeSelect } },
        orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    return {
      approved: [
        ...approvedTimeOff.map((request) => this.mapTimeOffEvent(request)),
        ...approvedVacations.map((request) => this.mapVacationEvent(request)),
      ].sort((a, b) => a.startDate.localeCompare(b.startDate)),
      pending: [
        ...pendingTimeOff.map((request) => this.mapTimeOffEvent(request)),
        ...pendingVacations.map((request) => this.mapVacationEvent(request)),
      ].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    };
  }

  private mapTimeOffEvent(request: TimeOffWithUser) {
    return {
      id: request.id,
      absenceType: 'TIME_OFF' satisfies AbsenceType,
      startDate: this.formatDate(request.date),
      endDate: this.formatDate(request.date),
      employee: request.user,
      status: request.status,
      color: this.resolveColor('TIME_OFF', request.status),
      hours: request.hours,
      reason: request.reason,
      comment: request.comment,
    };
  }

  private mapVacationEvent(request: VacationWithUser) {
    return {
      id: request.id,
      absenceType: 'VACATION' satisfies AbsenceType,
      vacationType: request.vacationType,
      startDate: this.formatDate(request.startDate),
      endDate: this.formatDate(request.endDate),
      employee: request.user,
      status: request.status,
      color: this.resolveColor('VACATION', request.status),
      daysCount: request.daysCount,
      comment: request.comment,
    };
  }

  private buildVisibilityWhere(currentUser: User): Prisma.TimeOffRequestWhereInput {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return {};
    }

    if (currentUser.role === Role.LEAD) {
      return currentUser.teamId ? { user: { teamId: currentUser.teamId } } : { userId: currentUser.id };
    }

    return { userId: currentUser.id };
  }

  private async assertCanSeeTeam(currentUser: User, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return;
    }

    if (!currentUser.teamId || currentUser.teamId !== teamId) {
      throw new ForbiddenException('You cannot view this team calendar');
    }
  }

  private async assertCanSeeUser(currentUser: User, userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, teamId: true },
    });

    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return;
    }

    if (currentUser.role === Role.LEAD && currentUser.teamId && currentUser.teamId === target.teamId) {
      return;
    }

    if (currentUser.id === target.id) {
      return;
    }

    throw new ForbiddenException('You cannot view this user calendar');
  }

  private resolveColor(absenceType: AbsenceType, status: RequestStatus) {
    if (status === RequestStatus.PENDING) {
      return '#F59E0B';
    }

    if (absenceType === 'TIME_OFF') {
      return '#38BDF8';
    }

    return '#22C55E';
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
