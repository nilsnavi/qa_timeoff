import { createHmac, timingSafeEqual } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export type InitDataValidationResult =
  | { valid: true; user: TelegramUser }
  | { valid: false; reason: string };

@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(private readonly config: ConfigService) {}

  validateInitData(initData: string): InitDataValidationResult {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      this.logger.warn('[TelegramAuth] TELEGRAM_BOT_TOKEN is not configured');
      return { valid: false, reason: 'TELEGRAM_BOT_TOKEN is not configured' };
    }

    if (!initData) {
      this.logger.warn('[TelegramAuth] initData is empty');
      return { valid: false, reason: 'initData is empty' };
    }

    // Log safe diagnostic info (no full initData, no secrets)
    this.logger.log(`[TelegramAuth] Validating initData: length=${initData.length}`);

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      this.logger.warn('[TelegramAuth] hash parameter is missing from initData');
      return { valid: false, reason: 'hash parameter is missing' };
    }

    const authDateParam = params.get('auth_date');
    this.logger.log(`[TelegramAuth] auth_date=${authDateParam ?? 'missing'}, has_hash=true, has_user=${!!params.get('user')}`);

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
      this.logger.warn('[TelegramAuth] hash mismatch — initData may be tampered or TELEGRAM_BOT_TOKEN is wrong');
      return { valid: false, reason: 'hash mismatch' };
    }

    const authDate = Number(authDateParam ?? 0);
    const maxAgeSeconds = 60 * 60 * 24;
    if (Date.now() / 1000 - authDate > maxAgeSeconds) {
      this.logger.warn(`[TelegramAuth] auth_date expired: auth_date=${authDateParam}, max_age=${maxAgeSeconds}s`);
      return { valid: false, reason: 'auth_date expired' };
    }

    const rawUser = params.get('user');
    if (!rawUser) {
      this.logger.warn('[TelegramAuth] user parameter is missing from initData');
      return { valid: false, reason: 'user parameter is missing' };
    }

    try {
      const user = JSON.parse(rawUser) as TelegramUser;
      this.logger.log(`[TelegramAuth] Validation successful: user_id=${user.id}, username=${user.username ?? 'none'}`);
      return { valid: true, user };
    } catch {
      this.logger.warn(`[TelegramAuth] Failed to parse user JSON: length=${rawUser.length}`);
      return { valid: false, reason: 'user parse failed' };
    }
  }
}
