import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramAuthService, TelegramUser } from './telegram-auth.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly telegramAuth: TelegramAuthService,
  ) {}

  async telegramLogin(initData: string) {
    const telegramUser = this.telegramAuth.validateInitData(initData);
    if (!telegramUser) {
      throw new UnauthorizedException('Invalid Telegram InitData');
    }

    const user = await this.upsertTelegramUser(telegramUser);
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });

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

    const user = await this.prisma.user.upsert({
      where: { telegramId: String(telegramUser.id) },
      create: {
        telegramId: String(telegramUser.id),
        username: telegramUser.username,
        fullName,
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
