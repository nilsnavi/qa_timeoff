import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sends push notifications to individual users via Telegram Bot API.
 */
@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);
  private readonly botToken: string;

  constructor(private readonly config: ConfigService) {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN') ?? '';
  }

  async sendMessage(telegramId: string, text: string): Promise<boolean> {
    if (!this.botToken) {
      this.logger.warn('[TelegramNotification] TELEGRAM_BOT_TOKEN not configured, skipping notification');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.error(`[TelegramNotification] Failed to send message to ${telegramId}: ${body}`);
        return false;
      }

      this.logger.log(`[TelegramNotification] Message sent to ${telegramId}`);
      return true;
    } catch (error) {
      this.logger.error(`[TelegramNotification] Error sending message to ${telegramId}: ${error instanceof Error ? error.message : error}`);
      return false;
    }
  }

  async notifyPositionChange(telegramId: string, oldPosition: string | null, newPosition: string): Promise<boolean> {
    const oldText = oldPosition ? `"${oldPosition}"` : 'не указана';
    return this.sendMessage(telegramId, `📋 <b>Изменение должности</b>\n\nВаша должность изменена: ${oldText} → "${newPosition}"`);
  }
}
