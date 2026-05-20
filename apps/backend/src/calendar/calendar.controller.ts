import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  getCalendar(@CurrentUser() currentUser: User) {
    return this.calendarService.getCalendar(currentUser);
  }

  @Get('team/:teamId')
  getTeamCalendar(@CurrentUser() currentUser: User, @Param('teamId') teamId: string) {
    return this.calendarService.getTeamCalendar(currentUser, teamId);
  }

  @Get('user/:userId')
  getUserCalendar(@CurrentUser() currentUser: User, @Param('userId') userId: string) {
    return this.calendarService.getUserCalendar(currentUser, userId);
  }
}
