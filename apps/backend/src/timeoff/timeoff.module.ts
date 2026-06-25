import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TimeOffController } from './timeoff.controller';
import { TimeOffService } from './timeoff.service';

@Module({
  imports: [BalanceModule, NotificationsModule, EventsModule],
  controllers: [TimeOffController],
  providers: [TimeOffService],
})
export class TimeOffModule {}
