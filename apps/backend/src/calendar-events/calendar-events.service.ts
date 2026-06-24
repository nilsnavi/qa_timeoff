import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CalendarEventStatus, CalendarEventType, Prisma, Role, User } from '@prisma/client';
import { CalendarEventEvents, EventBusService } from '../events';
import { NotificationType } from '../notifications/notification-types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { QueryCalendarEventsDto } from './dto/query-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

const calendarEventInclude = {
  user: {
    select: {
      id: true,
      fullName: true,
      username: true,
      role: true,
      teamId: true,
      team: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.CalendarEventInclude;

@Injectable()
export class CalendarEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(currentUser: User, dto: CreateCalendarEventDto) {
    const targetUserId = dto.userId ?? currentUser.id;
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, teamId: true, role: true },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUserId !== currentUser.id && !this.canManageOther(currentUser)) {
      throw new ForbiddenException('You can only create events for yourself');
    }

    if (dto.type === 'HOLIDAY' && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admins can create holiday events');
    }

    if (dto.type === 'SICK_LEAVE' && targetUserId !== currentUser.id && !this.canManageOther(currentUser)) {
      throw new ForbiddenException('Sick leave can only be created by the employee or manager');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date cannot be before start date');
    }

    await this.validateOverlap(targetUserId, startDate, endDate);

    const event = await this.prisma.calendarEvent.create({
      data: {
        userId: targetUserId,
        teamId: targetUser.teamId,
        type: dto.type as CalendarEventType,
        startDate,
        endDate,
        status: CalendarEventStatus.PENDING,
        comment: dto.comment,
      },
      include: calendarEventInclude,
    });

    const managers = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.MANAGER, Role.ADMIN] },
        id: { not: targetUserId },
      },
      select: { id: true },
    });

    if (managers.length > 0) {
      await this.prisma.notification.createMany({
        data: managers.map((m) => ({
          userId: m.id,
          title: 'Новое событие в календаре',
          message: `${event.user.fullName} · ${this.getTypeLabel(event.type)}`,
          type: NotificationType.REQUEST_CREATED,
        })),
      });
    }

    this.eventBus.emit(CalendarEventEvents.CREATED, {
      eventId: event.id,
      userId: targetUserId,
      teamId: targetUser.teamId,
      type: dto.type,
      startDate: dto.startDate,
      endDate: dto.endDate,
    });

    return event;
  }

  async findAll(currentUser: User, query: QueryCalendarEventsDto) {
    const where = this.buildVisibilityWhere(currentUser, query);

    if (query.month) {
      const [yearStr, monthStr] = query.month.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr) - 1;
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      where.startDate = { lte: monthEnd };
      where.endDate = { gte: monthStart };
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 100, 200);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.calendarEvent.findMany({
        where,
        include: calendarEventInclude,
        orderBy: [{ startDate: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.calendarEvent.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(currentUser: User, id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: calendarEventInclude,
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    if (!this.canView(currentUser, event)) {
      throw new ForbiddenException('You cannot view this event');
    }

    return event;
  }

  async update(currentUser: User, id: string, dto: UpdateCalendarEventDto) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    if (!this.canManage(currentUser, event)) {
      throw new ForbiddenException('You cannot edit this event');
    }

    if (event.status !== CalendarEventStatus.PENDING && event.status !== CalendarEventStatus.CREATED) {
      throw new BadRequestException('Only pending events can be edited');
    }

    const changes: Record<string, unknown> = {};
    if (dto.type) changes.type = dto.type;
    if (dto.startDate) changes.startDate = dto.startDate;
    if (dto.endDate) changes.endDate = dto.endDate;
    if (dto.comment !== undefined) changes.comment = dto.comment;

    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type as CalendarEventType }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.comment !== undefined && { comment: dto.comment }),
      },
      include: calendarEventInclude,
    });

    this.eventBus.emit(CalendarEventEvents.UPDATED, {
      eventId: id,
      userId: event.userId,
      changes,
    });

    return updated;
  }

  async delete(currentUser: User, id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    if (!this.canManage(currentUser, event)) {
      throw new ForbiddenException('You cannot delete this event');
    }

    await this.prisma.calendarEvent.delete({ where: { id } });

    this.eventBus.emit(CalendarEventEvents.DELETED, {
      eventId: id,
      userId: event.userId,
    });

    return { id };
  }

  async approve(currentUser: User, id: string) {
    const event = await this.prisma.calendarEvent.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!event) {
      throw new NotFoundException('Calendar event not found');
    }

    if (!this.canManageOther(currentUser)) {
      throw new ForbiddenException('Only managers can approve events');
    }

    if (event.status !== CalendarEventStatus.PENDING) {
      throw new BadRequestException('Only pending events can be approved');
    }

    const updated = await this.prisma.calendarEvent.update({
      where: { id },
      data: { status: CalendarEventStatus.APPROVED },
      include: calendarEventInclude,
    });

    await this.prisma.notification.create({
      data: {
        userId: event.userId,
        title: 'Событие согласовано',
        message: `${this.getTypeLabel(event.type)} одобрен`,
        type: NotificationType.REQUEST_APPROVED,
      },
    });

    this.eventBus.emit(CalendarEventEvents.APPROVED, {
      eventId: id,
      userId: event.userId,
      teamId: event.teamId,
    });

    return updated;
  }

  private async validateOverlap(userId: string, startDate: Date, endDate: Date) {
    const overlapping = await this.prisma.calendarEvent.findFirst({
      where: {
        userId,
        status: { in: [CalendarEventStatus.PENDING, CalendarEventStatus.APPROVED, CalendarEventStatus.ACTIVE] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true, type: true },
    });

    if (overlapping) {
      const message = overlapping.type === 'SICK_LEKE' as any
        ? 'Даты пересекаются с больничным. Подтвердите создание.'
        : 'Даты пересекаются с существующим событием';
      throw new BadRequestException(message);
    }

    const timeOffOverlap = await this.prisma.timeOffRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] as any },
        date: { gte: startDate, lte: endDate },
      },
      select: { id: true },
    });

    if (timeOffOverlap) {
      throw new BadRequestException('Даты пересекаются с существующим отгулом');
    }

    const vacationOverlap = await this.prisma.vacationRequest.findFirst({
      where: {
        userId,
        status: { in: ['PENDING', 'APPROVED'] as any },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });

    if (vacationOverlap) {
      throw new BadRequestException('Даты пересекаются с существующим отпуском');
    }
  }

  private buildVisibilityWhere(currentUser: User, query: QueryCalendarEventsDto): Prisma.CalendarEventWhereInput {
    const where: Prisma.CalendarEventWhereInput = {};

    const isPrivileged = currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER;
    const isLead = currentUser.role === Role.LEAD;

    if (query.team_id && (isPrivileged || (isLead && currentUser.teamId === query.team_id))) {
      where.teamId = query.team_id;
    } else if (!query.team_id && !query.user_id) {
      if (currentUser.role === Role.EMPLOYEE) {
        where.userId = currentUser.id;
      } else if (isLead && currentUser.teamId) {
        where.teamId = currentUser.teamId;
      }
    }

    if (query.user_id && (isPrivileged || (isLead && currentUser.teamId === query.team_id))) {
      where.userId = query.user_id;
    }

    if (query.type) {
      where.type = query.type as CalendarEventType;
    }

    return where;
  }

  private canView(currentUser: User, event: { userId: string; teamId: string | null }) {
    if (currentUser.id === event.userId) return true;
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) return true;
    if (currentUser.role === Role.LEAD && currentUser.teamId && currentUser.teamId === event.teamId) return true;
    return false;
  }

  private canManage(currentUser: User, event: { userId: string }) {
    if (currentUser.id === event.userId) return true;
    return this.canManageOther(currentUser);
  }

  private canManageOther(currentUser: User) {
    return currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER || currentUser.role === Role.LEAD;
  }

  private getTypeLabel(type: string) {
    const labels: Record<string, string> = {
      VACATION: 'Отпуск',
      TIME_OFF: 'Отгул',
      SICK_LEAVE: 'Больничный',
      HOLIDAY: 'Праздник',
    };
    return labels[type] ?? type;
  }
}
