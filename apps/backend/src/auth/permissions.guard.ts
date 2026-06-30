import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user: { id: string; roleId?: string; role?: string } }>();
    const user = request.user;

    if (user?.role === 'ADMIN') {
      return true;
    }

    if (!user?.roleId) {
      throw new ForbiddenException('Доступ запрещён: роль не назначена');
    }

    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId: user.roleId },
      include: { permission: { select: { code: true } } },
    });

    const userPermissionCodes = rolePermissions.map(rp => rp.permission.code);
    const hasAll = requiredPermissions.every(p => userPermissionCodes.includes(p));

    if (!hasAll) {
      throw new ForbiddenException('Доступ запрещён: недостаточно прав');
    }

    return true;
  }
}
