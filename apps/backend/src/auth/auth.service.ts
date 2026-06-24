import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramAuthService, TelegramUser } from './telegram-auth.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly telegramAuth: TelegramAuthService,
  ) { }

  async telegramLogin(initData: string) {
    this.logger.log(`Telegram auth request received (initData length: ${initData?.length ?? 0})`);

    const result = this.telegramAuth.validateInitData(initData);
    if (!result.valid) {
      this.logger.warn(`Telegram auth rejected: ${result.reason}`);
      throw new UnauthorizedException(result.reason);
    }

    const telegramUser = result.user;
    const user = await this.resolveTelegramUser(telegramUser);
    const token = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      teamId: user.teamId,
    });

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

  private async resolveTelegramUser(telegramUser: TelegramUser) {
    const telegramId = String(telegramUser.id);
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
      include: { timeBalance: true, team: true, manager: true },
    });

    if (!user) {
      this.logger.warn(`User not found for telegramId=${telegramId}`);
      throw new UnauthorizedException('Пользователь не найден. Обратитесь к администратору.');
    }

    if (!user.isActive) {
      this.logger.warn(`User is inactive for telegramId=${telegramId}`);
      throw new UnauthorizedException('Доступ заблокирован. Обратитесь к администратору.');
    }

    const fullName =
      [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ') ||
      telegramUser.username;

    const shouldUpdate =
      (fullName && fullName !== user.fullName) ||
      (telegramUser.username && telegramUser.username !== user.username);

    if (shouldUpdate) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(fullName && { fullName }),
          ...(telegramUser.username && { username: telegramUser.username }),
        },
      });
    }

    if (!user.timeBalance) {
      await this.prisma.timeBalance.create({ data: { userId: user.id } });
    }

    return user;
  }
}
