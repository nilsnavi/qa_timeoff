import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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

  create(dto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        ...(dto.telegramId && { telegramId: dto.telegramId }),
        ...(dto.passwordHash && { passwordHash: dto.passwordHash }),
        fullName: dto.fullName,
        username: dto.username,
        email: dto.email,
        position: dto.position,
        hourlyRate: dto.hourlyRate ?? 0,
        role: dto.role ?? Role.EMPLOYEE,
        teamId: dto.teamId,
        managerId: dto.managerId,
        isActive: dto.isActive ?? true,
        timeBalance: {
          create: {},
        },
      },
      include: userInclude,
    });
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
