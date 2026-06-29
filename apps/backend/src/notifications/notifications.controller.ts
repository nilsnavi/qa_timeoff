import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EmailNotificationService } from './email-notification.service';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly email: EmailNotificationService,
  ) {}

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

  @Get('admin/smtp/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Проверить статус SMTP подключения' })
  async smtpStatus() {
    const configured = this.email.isConfigured();
    if (!configured) {
      return { configured: false, message: 'SMTP_HOST не задан — email-уведомления отключены' };
    }
    const result = await this.email.verifyConnection();
    return {
      configured: true,
      connected: result.ok,
      error: result.error ?? null,
      message: result.ok
        ? 'SMTP подключён и работает'
        : `Ошибка подключения: ${result.error}`,
    };
  }

  @Post('admin/smtp/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Отправить тестовое письмо' })
  async sendTestEmail(@Body() body: { email: string }) {
    if (!body.email || !body.email.includes('@')) {
      return { ok: false, error: 'Укажите корректный email' };
    }
    const result = await this.email.sendTestEmail(body.email);
    return {
      ...result,
      message: result.ok
        ? `Тестовое письмо отправлено на ${body.email}`
        : `Не удалось отправить: ${result.error}`,
    };
  }
}
