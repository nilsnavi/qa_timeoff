import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { ImportUserResult, ImportUserRow } from './dto/import-users.dto';
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

  async create(dto: CreateUserDto, organizationId: string): Promise<{ user: User; tempPassword: string }> {
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
        organizationId,
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
        roleId: dto.roleId,
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

  async importFromCsv(csvText: string, organizationId: string): Promise<ImportUserResult[]> {
    const lines = csvText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV должен содержать заголовок и хотя бы одну строку данных');
    }

    // Парсинг заголовка
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const colIndex = {
      fullName: header.indexOf('fullname'),
      email:    header.indexOf('email'),
      role:     header.indexOf('role'),
      teamName: header.indexOf('teamname'),
      position: header.indexOf('position'),
    };

    if (colIndex.fullName === -1 || colIndex.email === -1) {
      throw new BadRequestException('CSV должен содержать колонки: fullName, email');
    }

    const results: ImportUserResult[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const row: ImportUserRow = {
        fullName: cols[colIndex.fullName] ?? '',
        email:    cols[colIndex.email] ?? '',
        role:     cols[colIndex.role] ?? 'EMPLOYEE',
        teamName: colIndex.teamName !== -1 ? cols[colIndex.teamName] : undefined,
        position: colIndex.position !== -1 ? cols[colIndex.position] : undefined,
      };

      if (!row.fullName || !row.email) {
        results.push({ fullName: row.fullName, email: row.email, tempPassword: null, status: 'error', reason: 'fullName и email обязательны' });
        continue;
      }

      // Проверить валидность email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        results.push({ fullName: row.fullName, email: row.email, tempPassword: null, status: 'error', reason: 'Некорректный email' });
        continue;
      }

      // Проверить email на дублирование
      const existing = await this.prisma.user.findUnique({ where: { email: row.email } });
      if (existing) {
        results.push({ fullName: row.fullName, email: row.email, tempPassword: null, status: 'skipped', reason: 'Email уже занят' });
        continue;
      }

      // Найти команду по имени
      let teamId: string | null = null;
      if (row.teamName) {
        const team = await this.prisma.team.findFirst({ where: { name: { equals: row.teamName, mode: 'insensitive' } } });
        teamId = team?.id ?? null;
      }

      // Сопоставить роль
      const roleMap: Record<string, Role> = {
        admin: Role.ADMIN, administrator: Role.ADMIN, администратор: Role.ADMIN,
        manager: Role.MANAGER, руководитель: Role.MANAGER,
        lead: Role.LEAD, лид: Role.LEAD,
        employee: Role.EMPLOYEE, сотрудник: Role.EMPLOYEE,
      };
      const resolvedRole = roleMap[row.role.toLowerCase()] ?? Role.EMPLOYEE;

      try {
        const { user, tempPassword } = await this.create({
          fullName: row.fullName,
          email:    row.email,
          role:     resolvedRole,
          teamId:   teamId ?? undefined,
          position: row.position,
        }, organizationId);
        results.push({ fullName: user.fullName, email: user.email!, tempPassword, status: 'created' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
        results.push({ fullName: row.fullName, email: row.email, tempPassword: null, status: 'error', reason: message });
      }
    }

    return results;
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

  async getSchedule(userId: string) {
    const schedule = await this.prisma.workSchedule.findUnique({ where: { userId } });
    if (!schedule) {
      return {
        userId,
        scheduleType: 'STANDARD_5_2',
        workingDays: [1, 2, 3, 4, 5],
        hoursPerDay: 8,
        isDefault: true,
      };
    }
    return { ...schedule, isDefault: false };
  }
}
