import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CalendarEventsService } from './calendar-events.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';
import { QueryCalendarEventsDto } from './dto/query-calendar-events.dto';
import { UpdateCalendarEventDto } from './dto/update-calendar-event.dto';

@ApiTags('calendar-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar/events')
export class CalendarEventsController {
  constructor(private readonly calendarEventsService: CalendarEventsService) {}

  @Get()
  findAll(@CurrentUser() currentUser: User, @Query() query: QueryCalendarEventsDto) {
    return this.calendarEventsService.findAll(currentUser, query);
  }

  @Get(':id')
  findOne(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.calendarEventsService.findOne(currentUser, id);
  }

  @Post()
  create(@CurrentUser() currentUser: User, @Body() dto: CreateCalendarEventDto) {
    return this.calendarEventsService.create(currentUser, dto);
  }

  @Patch(':id')
  update(@CurrentUser() currentUser: User, @Param('id') id: string, @Body() dto: UpdateCalendarEventDto) {
    return this.calendarEventsService.update(currentUser, id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.calendarEventsService.delete(currentUser, id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  approve(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.calendarEventsService.approve(currentUser, id);
  }
}
