import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const roleInclude = {
  permissions: {
    include: {
      permission: true,
    },
  },
  _count: {
    select: { users: true },
  },
} satisfies Prisma.RoleModelInclude;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(params?: { search?: string; isSystem?: boolean; isActive?: boolean }) {
    const where: Prisma.RoleModelWhereInput = {};
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.isSystem !== undefined) {
      where.isSystem = params.isSystem;
    }
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    return this.prisma.roleModel.findMany({
      where,
      include: roleInclude,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.roleModel.findUnique({
      where: { id },
      include: roleInclude,
    });
    if (!role) throw new NotFoundException('Роль не найдена');
    return role;
  }

  async findByCode(code: string) {
    return this.prisma.roleModel.findUnique({ where: { code }, include: roleInclude });
  }

  async create(actor: User, dto: CreateRoleDto) {
    const existing = await this.prisma.roleModel.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException(`Роль с кодом "${dto.code}" уже существует`);
    }

    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.roleModel.create({
        data: {
          code: dto.code,
          name: dto.name,
          description: dto.description ?? '',
          isSystem: false,
          isActive: dto.isActive ?? true,
        },
      });

      let permissionCodes = dto.permissionCodes ?? [];

      if (dto.basedOnRoleCode) {
        const baseRole = await tx.roleModel.findUnique({
          where: { code: dto.basedOnRoleCode },
          include: { permissions: { include: { permission: true } } },
        });
        if (baseRole) {
          const baseCodes = baseRole.permissions.map(rp => rp.permission.code);
          permissionCodes = [...new Set([...baseCodes, ...permissionCodes])];
        }
      }

      if (permissionCodes.length > 0) {
        const permissions = await tx.permission.findMany({
          where: { code: { in: permissionCodes } },
          select: { id: true },
        });
        if (permissions.length > 0) {
          await tx.rolePermission.createMany({
            data: permissions.map(p => ({ roleId: created.id, permissionId: p.id })),
            skipDuplicates: true,
          });
        }
      }

      return tx.roleModel.findUnique({
        where: { id: created.id },
        include: roleInclude,
      });
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'ROLE_CREATED',
      entityType: 'Role',
      entityId: role!.id,
      payload: { code: dto.code, name: dto.name },
    });

    return role;
  }

  async update(actor: User, id: string, dto: UpdateRoleDto) {
    const role = await this.prisma.roleModel.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Роль не найдена');

    const updated = await this.prisma.roleModel.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.isActive,
      },
      include: roleInclude,
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'ROLE_UPDATED',
      entityType: 'Role',
      entityId: id,
      payload: { changes: dto },
    });

    return updated;
  }

  async delete(actor: User, id: string) {
    const role = await this.prisma.roleModel.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) throw new NotFoundException('Роль не найдена');
    if (role.isSystem) throw new BadRequestException('Нельзя удалить системную роль');
    if (role._count.users > 0) {
      throw new BadRequestException('Нельзя удалить роль, пока она назначена пользователям. Переназначьте пользователей на другую роль.');
    }

    await this.prisma.roleModel.delete({ where: { id } });

    await this.auditService.log({
      actorId: actor.id,
      action: 'ROLE_DELETED',
      entityType: 'Role',
      entityId: id,
      payload: { code: role.code, name: role.name },
    });

    return { success: true };
  }

  async clone(actor: User, id: string, newCode: string) {
    const role = await this.prisma.roleModel.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) throw new NotFoundException('Роль не найдена');

    const existing = await this.prisma.roleModel.findUnique({ where: { code: newCode } });
    if (existing) throw new BadRequestException(`Роль с кодом "${newCode}" уже существует`);

    const cloned = await this.prisma.$transaction(async (tx) => {
      const created = await tx.roleModel.create({
        data: {
          code: newCode,
          name: `${role.name} (копия)`,
          description: role.description,
          isSystem: false,
          isActive: true,
        },
      });

      const permIds = role.permissions.map(rp => rp.permission.id);
      if (permIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permIds.map(pid => ({ roleId: created.id, permissionId: pid })),
          skipDuplicates: true,
        });
      }

      return tx.roleModel.findUnique({
        where: { id: created.id },
        include: roleInclude,
      });
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'ROLE_CLONED',
      entityType: 'Role',
      entityId: id,
      payload: { sourceCode: role.code, clonedCode: newCode },
    });

    return cloned;
  }

  async updatePermissions(actor: User, id: string, permissionCodes: string[]) {
    const role = await this.prisma.roleModel.findUnique({
      where: { id },
      include: { permissions: { include: { permission: { select: { code: true } } } } },
    });
    if (!role) throw new NotFoundException('Роль не найдена');

    const oldCodes = role.permissions.map(rp => rp.permission.code);

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionCodes.length > 0) {
        const perms = await tx.permission.findMany({
          where: { code: { in: permissionCodes } },
          select: { id: true },
        });
        if (perms.length > 0) {
          await tx.rolePermission.createMany({
            data: perms.map(p => ({ roleId: id, permissionId: p.id })),
          });
        }
      }
    });

    const newCodes = permissionCodes;
    const addedCodes = newCodes.filter(c => !oldCodes.includes(c));
    const removedCodes = oldCodes.filter(c => !newCodes.includes(c));

    await this.auditService.log({
      actorId: actor.id,
      action: 'ROLE_PERMISSION_UPDATED',
      entityType: 'Role',
      entityId: id,
      payload: {
        roleCode: role.code,
        addedPermissions: addedCodes,
        removedPermissions: removedCodes,
      },
    });

    return this.findOne(id);
  }

  async getUsers(roleId: string) {
    const role = await this.prisma.roleModel.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Роль не найдена');

    return this.prisma.user.findMany({
      where: { roleId },
      select: {
        id: true,
        fullName: true,
        email: true,
        position: true,
        isActive: true,
        lastLoginAt: true,
        team: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async addUsers(actor: User, roleId: string, userIds: string[]) {
    const role = await this.prisma.roleModel.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Роль не найдена');
    if (!role.isActive) throw new BadRequestException('Нельзя назначить неактивную роль');

    const oldAssignments = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, roleId: true },
    });

    await this.prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { roleId },
    });

    for (const uid of userIds) {
      const old = oldAssignments.find(a => a.id === uid);
      await this.auditService.log({
        actorId: actor.id,
        action: 'USER_ROLE_CHANGED',
        entityType: 'User',
        entityId: uid,
        payload: { oldRoleId: old?.roleId ?? null, newRoleId: roleId, roleCode: role.code },
      });
    }

    return this.getUsers(roleId);
  }

  async removeUser(actor: User, roleId: string, userId: string) {
    const role = await this.prisma.roleModel.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Роль не найдена');
    if (role.code === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { roleId } });
      if (adminCount <= 1) {
        throw new BadRequestException('Нельзя удалить последнего администратора');
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: null },
    });

    await this.auditService.log({
      actorId: actor.id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'User',
      entityId: userId,
      payload: { oldRoleId: roleId, newRoleId: null, roleCode: role.code },
    });

    return this.getUsers(roleId);
  }

  async getKpi() {
    const [totalRoles, systemRoles, customRoles, usersWithRoles, usersWithoutRoles] = await Promise.all([
      this.prisma.roleModel.count(),
      this.prisma.roleModel.count({ where: { isSystem: true } }),
      this.prisma.roleModel.count({ where: { isSystem: false } }),
      this.prisma.user.count({ where: { roleId: { not: null } } }),
      this.prisma.user.count({ where: { roleId: null } }),
    ]);

    return {
      totalRoles,
      systemRoles,
      customRoles,
      usersWithRoles,
      usersWithoutRoles,
    };
  }

  async getAuditLog(roleId?: string, limit = 100, offset = 0) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: 'Role',
        ...(roleId ? { entityId: roleId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        actor: { select: { id: true, fullName: true } },
      },
    });
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
    });
  }

  async getPermissionMatrix() {
    const [roles, permissions] = await Promise.all([
      this.prisma.roleModel.findMany({
        where: { isActive: true },
        include: { permissions: { include: { permission: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.permission.findMany({
        orderBy: [{ groupName: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const rolePermMap = new Map<string, Set<string>>();
    for (const role of roles) {
      rolePermMap.set(role.id, new Set(role.permissions.map(rp => rp.permission.code)));
    }

    const matrix = permissions.map(perm => {
      const row: Record<string, boolean | string> = { code: perm.code, name: perm.name, group: perm.groupName };
      for (const role of roles) {
        row[role.code] = rolePermMap.get(role.id)?.has(perm.code) ?? false;
      }
      return row;
    });

    return {
      roles: roles.map(r => ({ id: r.id, code: r.code, name: r.name, isSystem: r.isSystem })),
      permissions: matrix,
    };
  }
}
