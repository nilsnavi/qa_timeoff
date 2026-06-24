import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramNotificationService } from './telegram-notification.service';

/**
 * Sends administrative notifications to the main admin(s) via Telegram.
 */
@Injectable()
export class AdminTelegramNotifier {
  private readonly logger = new Logger(AdminTelegramNotifier.name);
  private readonly adminTelegramId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly telegramNotification: TelegramNotificationService,
  ) {
    this.adminTelegramId = this.config.get<string>('ADMIN_TELEGRAM_ID') ?? '';
  }

  private async getAdminTelegramIds(): Promise<string[]> {
    // If ADMIN_TELEGRAM_ID is configured, use it
    if (this.adminTelegramId) {
      return [this.adminTelegramId];
    }

    // Otherwise, find all ADMIN users in DB
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { telegramId: true },
    });

    return admins.map((a) => a.telegramId).filter((id): id is string => id !== null);
  }

  async notifyOvertimeAdded(employeeName: string, hours: number, reason: string): Promise<void> {
    const ids = await this.getAdminTelegramIds();
    const text = `⏰ <b>Переработка добавлена</b>\n\nСотрудник: ${employeeName}\nЧасы: ${hours} ч\nПричина: ${reason}`;

    for (const id of ids) {
      await this.telegramNotification.sendMessage(id, text);
    }
  }

  async notifyPositionChanged(adminName: string, employeeName: string, oldPosition: string | null, newPosition: string): Promise<void> {
    const ids = await this.getAdminTelegramIds();
    const oldText = oldPosition ? `"${oldPosition}"` : 'не указана';
    const text = `📋 <b>Должность изменена</b>\n\nАдминистратор: ${adminName}\nСотрудник: ${employeeName}\n${oldText} → "${newPosition}"`;

    for (const id of ids) {
      await this.telegramNotification.sendMessage(id, text);
    }
  }

  async notifyCriticalOvertime(employeeName: string, totalHours: number, month: string): Promise<void> {
    const ids = await this.getAdminTelegramIds();
    const text = `🚨 <b>Критическая переработка!</b>\n\nСотрудник: ${employeeName}\nВсего часов в ${month}: ${totalHours} ч\nПревышение лимита (>20 ч/мес)`;

    for (const id of ids) {
      await this.telegramNotification.sendMessage(id, text);
    }
  }
}
