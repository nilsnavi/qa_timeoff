import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateTempPassword } from '../auth/temp-password.util';
import { EmailNotificationService } from '../notifications/email-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const userInclude = {
  team: true,
  manager: true,
  timeBalance: true,
} satisfies Prisma.UserInclude;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailNotificationService,
  ) {}

  findAll(currentUser: User) {
    return this.prisma.user.findMany({
      where: this.buildVisibilityWhere(currentUser),
      include: userInclude,
      orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    });
  }

  async findOne(currentUser: User, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: userInclude,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!this.canSeeUser(currentUser, user)) {
      throw new ForbiddenException('You cannot view this user');
    }

    return user;
  }

  async create(dto: CreateUserDto): Promise<{ user: User; tempPassword: string }> {
    if (!dto.email) {
      throw new BadRequestException('Email обязателен для создания пользователя');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        username: dto.username,
        position: dto.position,
        role: dto.role ?? 'EMPLOYEE',
        teamId: dto.teamId ?? null,
        managerId: dto.managerId ?? null,
        isActive: dto.isActive ?? true,
        passwordHash,
        mustChangePassword: true,
        ...(dto.telegramId && { telegramId: dto.telegramId }),
        timeBalance: { create: {} },
      },
      include: userInclude,
    });

    this.email.sendTempPassword(user.email!, user.fullName, tempPassword, false)
      .catch(err => console.error('Email send failed:', err));

    return { user: user as User, tempPassword };
  }

  update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        telegramId: dto.telegramId,
        fullName: dto.fullName,
        username: dto.username,
        email: dto.email,
        position: dto.position,
        hourlyRate: dto.hourlyRate,
        role: dto.role,
        teamId: dto.teamId,
        managerId: dto.managerId,
        isActive: dto.isActive,
      },
      include: userInclude,
    });
  }

  updateNotifications(userId: string, dto: UpdateNotificationsDto) {
    const data: Record<string, boolean> = {};
    if (dto.notifyRequestUpdates !== undefined) data.notifyRequestUpdates = dto.notifyRequestUpdates;
    if (dto.notifyTeamRequests !== undefined) data.notifyTeamRequests = dto.notifyTeamRequests;
    if (dto.notifyEmailDigest !== undefined) data.notifyEmailDigest = dto.notifyEmailDigest;
    return this.prisma.user.update({ where: { id: userId }, data });
  }

  async resetPassword(targetUserId: string): Promise<{ tempPassword: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true, email: true, isActive: true },
    });

    if (!user) throw new NotFoundException('Пользователь не найден');
    if (!user.isActive) throw new BadRequestException('Пользователь заблокирован');
    if (!user.email) throw new BadRequestException('У пользователя нет email для отправки пароля');

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash, mustChangePassword: true },
    });

    this.email.sendTempPassword(user.email, user.fullName, tempPassword, true)
      .catch(err => console.error('Email send failed:', err));

    return { tempPassword };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      throw new BadRequestException('Пароль не установлен');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Текущий пароль неверен');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Новый пароль должен отличаться от временного');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    return { success: true };
  }

  remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      include: userInclude,
    });
  }

  private buildVisibilityWhere(currentUser: User): Prisma.UserWhereInput {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return {};
    }

    if (currentUser.role === Role.LEAD) {
      return currentUser.teamId ? { teamId: currentUser.teamId } : { id: currentUser.id };
    }

    return { id: currentUser.id };
  }

  private canSeeUser(currentUser: User, targetUser: User) {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return true;
    }

    if (currentUser.role === Role.LEAD) {
      return !!currentUser.teamId && currentUser.teamId === targetUser.teamId;
    }

    return currentUser.id === targetUser.id;
  }
}
