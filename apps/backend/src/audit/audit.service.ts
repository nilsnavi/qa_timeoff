import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const auditInclude = {
  actor: { select: { id: true, fullName: true } },
} as const;

export interface AuditLogParams {
  actorId: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  result?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  payload?: Record<string, unknown>;
}

export interface AuditQueryParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  actorId?: string;
  action?: string;
  entityType?: string;
  result?: string;
  ipAddress?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams) {
    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorName: params.actorName,
        actorRole: params.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        entityName: params.entityName,
        result: params.result ?? 'SUCCESS',
        oldValue: params.oldValue as Prisma.InputJsonValue,
        newValue: params.newValue as Prisma.InputJsonValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        payload: params.payload as Prisma.InputJsonValue,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.auditLog.findUnique({
      where: { id },
      include: auditInclude,
    });
  }

  async findAll(params?: AuditQueryParams) {
    const where = this.buildWhere(params);

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const offset = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: auditInclude,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findKpi(params?: AuditQueryParams) {
    const baseWhere = this.buildWhere(params);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, errors, criticalActions, activeUsers] = await Promise.all([
      this.prisma.auditLog.count({ where: baseWhere }),
      this.prisma.auditLog.count({
        where: { ...baseWhere, createdAt: { gte: today } },
      }),
      this.prisma.auditLog.count({
        where: { ...baseWhere, result: 'ERROR' },
      }),
      this.prisma.auditLog.count({
        where: {
          ...baseWhere,
          action: {
            in: [
              'ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DELETED',
              'USER_CREATED', 'USER_DELETED', 'USER_ROLE_CHANGED',
              'TEAM_DELETED', 'COMPANY_SETTINGS_UPDATED',
            ],
          },
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorId'],
        where: baseWhere,
        _count: true,
      }).then(g => g.length),
    ]);

    return { total, todayCount, errors, criticalActions, activeUsers };
  }

  private buildWhere(params?: AuditQueryParams): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};

    if (params?.search) {
      const s = params.search;
      where.OR = [
        { actorName: { contains: s, mode: 'insensitive' } },
        { actor: { email: { contains: s, mode: 'insensitive' } } },
        { action: { contains: s, mode: 'insensitive' } },
        { entityType: { contains: s, mode: 'insensitive' } },
        { entityId: { contains: s, mode: 'insensitive' } },
        { entityName: { contains: s, mode: 'insensitive' } },
        { ipAddress: { contains: s, mode: 'insensitive' } },
      ];
    }

    if (params?.dateFrom || params?.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) (where.createdAt as any).gte = new Date(params.dateFrom);
      if (params.dateTo) (where.createdAt as any).lte = new Date(params.dateTo);
    }

    if (params?.actorId) where.actorId = params.actorId;
    if (params?.action) where.action = params.action;
    if (params?.entityType) where.entityType = params.entityType;
    if (params?.result) where.result = params.result;
    if (params?.ipAddress) where.ipAddress = params.ipAddress;

    return where;
  }

  async exportCsv(params?: AuditQueryParams): Promise<string> {
    const logs = await this.prisma.auditLog.findMany({
      where: this.buildWhere(params),
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: auditInclude,
    });

    const header = 'Дата и время,Пользователь,Роль,Действие,Раздел,Объект,Результат,IP';
    const rows = logs.map(l =>
      [
        l.createdAt.toISOString(),
        `"${l.actorName || l.actor.fullName || ''}"`,
        l.actorRole || '',
        l.action,
        l.entityType,
        `"${l.entityName || l.entityId || ''}"`,
        l.result,
        l.ipAddress || '',
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}
