import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PrismaModule } from './prisma/prisma.module';
import { RequestsModule } from './requests/requests.module';
import { AdminModule } from './admin/admin.module';
import { TeamsModule } from './teams/teams.module';
import { UsersModule } from './users/users.module';
import { BalanceModule } from './balance/balance.module';
import { TimeOffModule } from './timeoff/timeoff.module';
import { VacationModule } from './vacation/vacation.module';
import { CalendarModule } from './calendar/calendar.module';
import { NotificationsModule } from './notifications/notifications.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    DashboardModule,
    RequestsModule,
    AdminModule,
    UsersModule,
    TeamsModule,
    BalanceModule,
    TimeOffModule,
    VacationModule,
    CalendarModule,
    NotificationsModule,
  ],
})
export class AppModule {}
