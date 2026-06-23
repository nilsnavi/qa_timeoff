import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';
import { AdminTelegramNotifier } from '../notifications/admin-telegram-notifier.service';
import { TelegramNotificationService } from '../notifications/telegram-notification.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminService, TelegramNotificationService, AdminTelegramNotifier, AuditService],
})
export class AdminModule {}
