import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { TelegramAuthService, TelegramUser } from './telegram-auth.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshExpiration: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegramAuth: TelegramAuthService,
    private readonly auditService: AuditService,
  ) {
    this.refreshExpiration = this.config.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d';
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { timeBalance: true, team: true, manager: true },
    });

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Доступ заблокирован. Обратитесь к администратору.');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.issueToken(user),
      this.issueRefreshToken(user.id),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.auditService.log({
      actorId: user.id,
      actorName: user.fullName,
      actorRole: user.role,
      action: 'AUTH_LOGIN_SUCCESS',
      entityType: 'Auth',
      entityId: user.id,
      entityName: user.email ?? user.fullName,
      result: 'SUCCESS',
    });

    this.logger.log(`User logged in via web: ${user.fullName} (id=${user.id}, role=${user.role})`);

    return { accessToken, refreshToken: refreshToken.token, user, mustChangePassword: user.mustChangePassword };
  }

  async telegramLogin(initData: string) {
    if (this.config.get<string>('ENABLE_TELEGRAM_AUTH') !== 'true') {
      throw new UnauthorizedException(
        'Telegram auth is disabled. Set ENABLE_TELEGRAM_AUTH=true in .env to enable.',
      );
    }

    this.logger.log(`Telegram auth request received (initData length: ${initData?.length ?? 0})`);

    const result = this.telegramAuth.validateInitData(initData);
    if (!result.valid) {
      this.logger.warn(`Telegram auth rejected: ${result.reason}`);
      throw new UnauthorizedException(result.reason);
    }

    const telegramUser = result.user;
    const user = await this.resolveTelegramUser(telegramUser);
    const accessToken = await this.issueToken(user);
    const refreshToken = await this.issueRefreshToken(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`User authenticated via Telegram: ${user.fullName} (id=${user.id}, role=${user.role})`);

    return {
      accessToken,
      refreshToken: refreshToken.token,
      user,
    };
  }

  async refreshTokens(refreshTokenStr: string) {
    const tokenHash = this.hashToken(refreshTokenStr);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: { include: { timeBalance: true, team: true, manager: true } },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Недействительный refresh token');
    }

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Refresh token истёк');
    }

    if (!stored.user.isActive) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Доступ заблокирован. Обратитесь к администратору.');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const [accessToken, refreshToken] = await Promise.all([
      this.issueToken(stored.user),
      this.issueRefreshToken(stored.user.id),
    ]);

    this.logger.log(`Tokens refreshed for user: ${stored.user.fullName} (id=${stored.user.id})`);

    return { accessToken, refreshToken: refreshToken.token, user: stored.user };
  }

  async logout(refreshTokenStr: string) {
    const tokenHash = this.hashToken(refreshTokenStr);
    await this.prisma.refreshToken.deleteMany({
      where: { tokenHash },
    });
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

  async registerOrganization(dto: RegisterOrganizationDto) {
    const baseSlug = dto.companyName
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'company';

    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } });
    if (existingUser) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const result = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.companyName,
          slug,
          plan: 'FREE',
          seatsLimit: 10,
          subscriptionStatus: 'TRIAL',
          trialEndsAt,
        },
      });

      const admin = await tx.user.create({
        data: {
          organizationId: organization.id,
          fullName: dto.adminFullName,
          email: dto.adminEmail,
          passwordHash,
          role: 'ADMIN',
          mustChangePassword: false,
          timeBalance: { create: {} },
        },
      });

      return { organization, admin };
    });

    const token = await this.jwt.signAsync({
      sub: result.admin.id,
      role: result.admin.role,
      organizationId: result.organization.id,
    });

    const refreshToken = await this.issueRefreshToken(result.admin.id);

    this.logger.log(`New organization registered: ${result.organization.name} (${result.organization.slug})`);

    return {
      accessToken: token,
      refreshToken: refreshToken.token,
      user: result.admin,
      organization: result.organization,
    };
  }

  private async issueToken(user: { id: string; role: string; teamId: string | null; organizationId: string }) {
    return this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      teamId: user.teamId,
      organizationId: user.organizationId,
    });
  }

  private async issueRefreshToken(userId: string) {
    const rawToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.parseExpiration(this.refreshExpiration);

    await this.prisma.refreshToken.create({
      data: { tokenHash, userId, expiresAt },
    });

    return { token: rawToken, userId, expiresAt };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private parseExpiration(value: string): Date {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const num = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + num * (multipliers[unit] ?? 24 * 60 * 60 * 1000));
  }

  private async resolveTelegramUser(telegramUser: TelegramUser) {
    const telegramId = String(telegramUser.id);
    const user = await this.prisma.user.findFirst({
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
