import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CompanySettingsController } from './company-settings.controller';
import { CompanySettingsService } from './company-settings.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CompanySettingsController],
  providers: [CompanySettingsService],
  exports: [CompanySettingsService],
})
export class CompanySettingsModule {}
