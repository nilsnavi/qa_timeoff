import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai-forecast.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BalanceModule } from './balance/balance.module';
import { AppCacheModule } from './cache/cache.module';
import { CalendarModule } from './calendar/calendar.module';
import { CalendarEventsModule } from './calendar-events/calendar-events.module';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { ExportModule } from './export/export.module';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { HealthModule } from './health/health.module';
import { KpiModule } from './kpi/kpi.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { MetricsModule } from './metrics/metrics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestsModule } from './requests/requests.module';
import { TeamsModule } from './teams/teams.module';
import { TimeOffModule } from './timeoff/timeoff.module';
import { UsersModule } from './users/users.module';
import { VacationModule } from './vacation/vacation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.RATE_LIMIT_TTL ?? 60) * 1000,
          limit: Number(process.env.RATE_LIMIT_MAX ?? 100),
        },
      ],
    }),
    AppCacheModule,
    PrismaModule,
    AuthModule,
    DashboardModule,
    EventsModule,
    LeaveRequestsModule,
    RequestsModule,
    AdminModule,
    UsersModule,
    TeamsModule,
    BalanceModule,
    TimeOffModule,
    VacationModule,
    CalendarModule,
    CalendarEventsModule,
    NotificationsModule,
    HealthModule,
    MetricsModule,
    KpiModule,
    AnalyticsModule,
    AiModule,
    ExportModule,
    AuditModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule {}
