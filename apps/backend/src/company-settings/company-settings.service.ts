import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async get() {
    const settings = await this.prisma.companySettings.findFirst({ include: { updatedBy: { select: { id: true, fullName: true } } } });
    if (!settings) {
      return this.prisma.companySettings.create({ data: {} });
    }
    return this.maskSecrets(settings);
  }

  async getForManager() {
    const s = await this.prisma.companySettings.findFirst();
    if (!s) return null;
    return {
      companyName: s.companyName, timezone: s.timezone, workWeekDays: s.workWeekDays,
      workingHoursPerDay: s.workingHoursPerDay, workingDaysPerWeek: s.workingDaysPerWeek,
      defaultAnnualHours: s.defaultAnnualHours, locale: s.locale, dateFormat: s.dateFormat,
    };
  }

  async update(actor: User, dto: UpdateCompanySettingsDto) {
    const existing = await this.prisma.companySettings.findFirst();
    const oldValues = existing ? this.extractChangedFields(existing, dto as unknown as Record<string, unknown>) : {};

    const result = await (existing
      ? this.prisma.companySettings.update({
          where: { id: existing.id },
          data: { ...dto, updatedById: actor.id },
          include: { updatedBy: { select: { id: true, fullName: true } } },
        })
      : this.prisma.companySettings.create({
          data: { ...dto, updatedById: actor.id } as any,
          include: { updatedBy: { select: { id: true, fullName: true } } },
        })
    );

    await this.auditService.log({
      actorId: actor.id, actorName: actor.fullName, actorRole: actor.role,
      action: 'COMPANY_SETTINGS_UPDATED', entityType: 'CompanySettings', entityId: result.id,
      result: 'SUCCESS',
      oldValue: oldValues as any,
      newValue: dto as any,
    });

    return this.maskSecrets(result);
  }

  async getAudit() {
    return this.prisma.auditLog.findMany({
      where: { entityType: 'CompanySettings' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: { select: { id: true, fullName: true } } },
    });
  }

  private extractChangedFields(existing: any, dto: Record<string, unknown>): Record<string, unknown> {
    const changed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && (existing as any)[key] !== value) {
        changed[key] = (existing as any)[key];
      }
    }
    return changed;
  }

  private maskSecrets(settings: any) {
    const masked = { ...settings };
    if (masked.smtpPassword) masked.smtpPassword = '••••••••';
    if (masked.telegramBotToken) masked.telegramBotToken = '••••••••••••••••••••••';
    return masked;
  }
}
