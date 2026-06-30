import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { CompanySettingsModule } from '../company-settings/company-settings.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [CalendarModule, CompanySettingsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
