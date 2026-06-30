import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { HolidaysService } from './holidays.service';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService, HolidaysService],
  exports: [HolidaysService],
})
export class CalendarModule {}
