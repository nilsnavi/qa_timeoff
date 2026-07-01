import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeaveRequestType, RequestStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '../notifications/notification-types';

@Injectable()
export class ApprovalScheduler {
  private readonly logger = new Logger(ApprovalScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Cron('0 * * * *')
  async processSLAUpdates() {
    this.logger.log('Running SLA status updates...');
    await this.activateStartedRequests();
    await this.expireCompletedRequests();
    await this.sendSLAReminders();
    this.logger.log('SLA updates complete');
  }

  private async activateStartedRequests() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toActivate = await this.prisma.leaveRequest.findMany({
      where: {
        status: { in: [RequestStatus.APPROVED, RequestStatus.PENDING] },
        dateFrom: { lte: today },
      },
      select: { id: true, userId: true },
    });

    if (toActivate.length === 0) return;

    await this.prisma.leaveRequest.updateMany({
      where: { id: { in: toActivate.map(r => r.id) } },
      data: { status: RequestStatus.ACTIVE },
    });

    for (const r of toActivate) {
      await this.prisma.notification.create({
        data: {
          userId: r.userId,
          title: 'Заявка активирована',
          message: 'Ваша заявка перешла в статус «Активно»',
          type: NotificationType.REQUEST_APPROVED,
        },
      });
    }

    this.logger.log(`Activated ${toActivate.length} requests`);
  }

  private async expireCompletedRequests() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    const toExpire = await this.prisma.leaveRequest.findMany({
      where: {
        status: { in: [RequestStatus.ACTIVE, RequestStatus.APPROVED] },
        dateTo: { lte: yesterday },
      },
      select: { id: true, userId: true },
    });

    if (toExpire.length === 0) return;

    await this.prisma.leaveRequest.updateMany({
      where: { id: { in: toExpire.map(r => r.id) } },
      data: { status: RequestStatus.EXPIRED },
    });

    for (const r of toExpire) {
      await this.prisma.notification.create({
        data: {
          userId: r.userId,
          title: 'Заявка истекла',
          message: 'Срок вашей заявки истёк',
          type: NotificationType.REQUEST_APPROVED,
        },
      });
    }

    this.logger.log(`Expired ${toExpire.length} requests`);
  }

  private async sendSLAReminders() {
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + 1);

    const slaViolations = await this.prisma.leaveRequest.findMany({
      where: {
        status: RequestStatus.PENDING,
        slaDueDate: { lte: thresholdDate },
        OR: [
          { lastReminderSentAt: null },
          { lastReminderSentAt: { lte: new Date(now.getTime() - 4 * 3600000) } },
        ],
      },
      include: {
        user: { select: { id: true, fullName: true, teamId: true } },
      },
    });

    if (slaViolations.length === 0) return;

    for (const req of slaViolations) {
      const approvers = await this.prisma.user.findMany({
        where: {
          teamId: req.teamId ?? req.user.teamId ?? undefined,
          role: { in: ['LEAD', 'MANAGER', 'ADMIN'] },
          isActive: true,
        },
        select: { id: true },
      });

      if (approvers.length > 0) {
        await this.prisma.notification.createMany({
          data: approvers.map(a => ({
            userId: a.id,
            title: 'Напоминание SLA',
            message: `Заявка #${req.id.slice(0, 8)} от ${req.user.fullName} ожидает согласования (SLA)`,
            type: NotificationType.VACATION_REMINDER,
          })),
        });
      }

      await this.prisma.leaveRequest.update({
        where: { id: req.id },
        data: { lastReminderSentAt: now },
      });

      await this.audit.log({
        actorId: 'SYSTEM',
        action: 'REMINDER',
        entityType: 'LeaveRequest',
        entityId: req.id,
        entityName: `SLA reminder для #${req.id.slice(0, 8)}`,
      });
    }

    this.logger.log(`Sent SLA reminders for ${slaViolations.length} requests`);
  }
}
