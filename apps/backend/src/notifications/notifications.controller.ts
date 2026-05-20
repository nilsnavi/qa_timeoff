import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: User) {
    return this.notificationsService.findAll(currentUser.id);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.notificationsService.markAsRead(currentUser.id, id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() currentUser: User) {
    return this.notificationsService.markAllAsRead(currentUser.id);
  }
}
