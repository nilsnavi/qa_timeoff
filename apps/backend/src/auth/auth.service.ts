import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramAuthService, TelegramUser } from './telegram-auth.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly telegramAuth: TelegramAuthService,
    private readonly config: ConfigService,
  ) { }

  async telegramLogin(initData: string) {
    this.logger.log('Telegram auth request received');
    this.logger.log(`initData length: ${initData?.length ?? 0}`);

    const telegramUser = this.telegramAuth.validateInitData(initData);
    if (!telegramUser) {
      this.logger.warn('Invalid Telegram initData');
      throw new UnauthorizedException('Invalid Telegram InitData');
    }

    const user = await this.upsertTelegramUser(telegramUser);
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });

    this.logger.log(`User authenticated: ${user.fullName} (id=${user.id}, role=${user.role})`);

    return {
      token,
      accessToken: token,
      user,
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        team: true,
        manager: true,
        timeBalance: true,
      },
    });
  }

  private async upsertTelegramUser(telegramUser: TelegramUser) {
    const fullName =
      [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') ||
      telegramUser.username ||
      `Telegram ${telegramUser.id}`;

    const adminTelegramId = this.config.get<string>('ADMIN_TELEGRAM_ID');
    const isFirstUser = !(await this.prisma.user.findFirst());
    const shouldBeAdmin =
      (adminTelegramId && String(telegramUser.id) === adminTelegramId) ||
      (isFirstUser && !adminTelegramId);

    const user = await this.prisma.user.upsert({
      where: { telegramId: String(telegramUser.id) },
      create: {
        telegramId: String(telegramUser.id),
        username: telegramUser.username,
        fullName,
        role: shouldBeAdmin ? Role.ADMIN : Role.EMPLOYEE,
        timeBalance: {
          create: {},
        },
      },
      update: {
        username: telegramUser.username,
        fullName,
      },
      include: { timeBalance: true, team: true, manager: true },
    });

    if (!user.timeBalance) {
      await this.prisma.timeBalance.create({ data: { userId: user.id } });
    }

    return user;
  }
}
