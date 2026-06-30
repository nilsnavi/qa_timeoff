import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

const teamInclude = {
  users: {
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      position: true,
      role: true,
      isActive: true,
    },
    orderBy: { fullName: 'asc' },
  },
} satisfies Prisma.TeamInclude;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(currentUser: User) {
    return this.prisma.team.findMany({
      where: this.buildVisibilityWhere(currentUser),
      include: teamInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(currentUser: User, id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: teamInclude,
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }
    if (!this.canSeeTeam(currentUser, id)) {
      throw new ForbiddenException('You cannot view this team');
    }

    return team;
  }

  create(dto: CreateTeamDto, organizationId: string) {
    return this.prisma.team.create({
      data: { ...dto, organizationId },
      include: teamInclude,
    });
  }

  update(id: string, dto: UpdateTeamDto) {
    return this.prisma.team.update({
      where: { id },
      data: dto,
      include: teamInclude,
    });
  }

  remove(id: string) {
    return this.prisma.team.delete({
      where: { id },
      include: teamInclude,
    });
  }

  private buildVisibilityWhere(currentUser: User): Prisma.TeamWhereInput {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return {};
    }

    if (currentUser.role === Role.LEAD || currentUser.role === Role.EMPLOYEE) {
      return currentUser.teamId ? { id: currentUser.teamId } : { id: '__no_team__' };
    }

    return { id: '__no_team__' };
  }

  private canSeeTeam(currentUser: User, teamId: string) {
    if (currentUser.role === Role.ADMIN || currentUser.role === Role.MANAGER) {
      return true;
    }

    return !!currentUser.teamId && currentUser.teamId === teamId;
  }
}
