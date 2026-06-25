import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VacationController } from './vacation.controller';
import { VacationService } from './vacation.service';

@Module({
  imports: [NotificationsModule, EventsModule],
  controllers: [VacationController],
  providers: [VacationService],
})
export class VacationModule {}
