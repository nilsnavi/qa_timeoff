import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JiraWorklogService } from '../jira/jira-worklog.service';

@Injectable()
export class WorklogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jiraWorklog: JiraWorklogService,
  ) {}

  async create(user: User, dto: {
    jiraIssueId?: string;
    issueKeyManual?: string;
    date: string;
    hours: number;
    comment?: string;
  }) {
    if (dto.hours <= 0 || dto.hours > 24) {
      throw new BadRequestException('Часы должны быть от 0.1 до 24');
    }
    if (!dto.jiraIssueId && !dto.issueKeyManual) {
      throw new BadRequestException('Укажите задачу Jira или введите ключ вручную');
    }

    const entry = await this.prisma.worklogEntry.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        jiraIssueId: dto.jiraIssueId,
        issueKeyManual: dto.issueKeyManual,
        date: new Date(dto.date),
        hours: dto.hours,
        comment: dto.comment,
        syncStatus: dto.jiraIssueId ? 'PENDING' : 'SYNCED',
      },
      include: { jiraIssue: true },
    });

    if (entry.jiraIssueId) {
      this.jiraWorklog.pushToJira(entry.id).catch(() => {});
    }

    return entry;
  }

  async findMyEntries(user: User, params: { startDate?: string; endDate?: string }) {
    return this.prisma.worklogEntry.findMany({
      where: {
        userId: user.id,
        ...(params.startDate || params.endDate
          ? {
              date: {
                ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
                ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
              },
            }
          : {}),
      },
      include: { jiraIssue: true },
      orderBy: { date: 'desc' },
    });
  }

  async update(user: User, id: string, dto: { hours?: number; comment?: string }) {
    const entry = await this.prisma.worklogEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Запись не найдена');
    if (entry.userId !== user.id) throw new ForbiddenException();

    const updated = await this.prisma.worklogEntry.update({
      where: { id },
      data: { ...dto, syncStatus: entry.jiraIssueId ? 'PENDING' : entry.syncStatus },
      include: { jiraIssue: true },
    });

    if (updated.jiraIssueId) {
      this.jiraWorklog.pushToJira(updated.id).catch(() => {});
    }

    return updated;
  }

  async remove(user: User, id: string) {
    const entry = await this.prisma.worklogEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Запись не найдена');
    if (entry.userId !== user.id) throw new ForbiddenException();

    return this.prisma.worklogEntry.delete({ where: { id } });
  }

  async getWeeklySummary(user: User, weekStart: string) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const entries = await this.prisma.worklogEntry.findMany({
      where: { userId: user.id, date: { gte: start, lte: end } },
      include: { jiraIssue: true },
    });

    const byDay = new Map<string, number>();
    for (const e of entries) {
      const key = e.date.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + e.hours);
    }

    return {
      entries,
      totalHours: entries.reduce((acc: number, e) => acc + e.hours, 0),
      byDay: Array.from(byDay.entries()).map(([date, hours]) => ({ date, hours })),
    };
  }

  async getTeamReport(currentUser: User, params: { startDate: string; endDate: string; teamId?: string }) {
    const allowedRoles: Role[] = [Role.LEAD, Role.MANAGER, Role.ADMIN];
    if (!allowedRoles.includes(currentUser.role as Role)) {
      throw new ForbiddenException();
    }

    const userWhere = params.teamId
      ? { organizationId: currentUser.organizationId, teamId: params.teamId }
      : { organizationId: currentUser.organizationId };

    const entries = await this.prisma.worklogEntry.findMany({
      where: {
        organizationId: currentUser.organizationId,
        date: { gte: new Date(params.startDate), lte: new Date(params.endDate) },
        user: userWhere,
      },
      include: { jiraIssue: true, user: { select: { id: true, fullName: true, teamId: true } } },
    });

    const byUser = new Map<string, { fullName: string; totalHours: number }>();
    const byProject = new Map<string, number>();

    for (const e of entries) {
      const uKey = e.userId;
      if (!byUser.has(uKey)) byUser.set(uKey, { fullName: e.user.fullName, totalHours: 0 });
      byUser.get(uKey)!.totalHours += e.hours;

      const projectKey = e.jiraIssue?.projectKey ?? 'Без проекта';
      byProject.set(projectKey, (byProject.get(projectKey) ?? 0) + e.hours);
    }

    return {
      totalHours: entries.reduce((acc: number, e) => acc + e.hours, 0),
      byUser: Array.from(byUser.entries()).map(([userId, v]) => ({ userId, ...v })),
      byProject: Array.from(byProject.entries()).map(([projectKey, hours]) => ({ projectKey, hours })),
      entriesCount: entries.length,
    };
  }
}
