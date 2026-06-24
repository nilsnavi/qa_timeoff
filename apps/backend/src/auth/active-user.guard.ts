import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user: User }>().user;

    if (!user) {
      throw new UnauthorizedException('Пользователь не аутентифицирован');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Доступ заблокирован. Обратитесь к администратору.');
    }

    return true;
  }
}
