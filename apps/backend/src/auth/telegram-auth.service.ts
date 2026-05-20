import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

@Injectable()
export class TelegramAuthService {
  constructor(private readonly config: ConfigService) {}

  validateInitData(initData: string): TelegramUser | null {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken || !initData) {
      return null;
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return null;
    }

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = createHmac('sha256', secret).update(dataCheckString).digest('hex');

    const calculatedHashBuffer = Buffer.from(calculatedHash, 'hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    if (calculatedHashBuffer.length !== hashBuffer.length || !timingSafeEqual(calculatedHashBuffer, hashBuffer)) {
      return null;
    }

    const authDate = Number(params.get('auth_date') ?? 0);
    const maxAgeSeconds = 60 * 60 * 24;
    if (Date.now() / 1000 - authDate > maxAgeSeconds) {
      return null;
    }

    const rawUser = params.get('user');
    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser) as TelegramUser;
    } catch {
      return null;
    }
  }
}
