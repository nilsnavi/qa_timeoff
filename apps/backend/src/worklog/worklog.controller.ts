import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorklogService } from './worklog.service';

@ApiTags('worklog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('worklog')
export class WorklogController {
  constructor(private readonly worklogService: WorklogService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: any) {
    return this.worklogService.create(user, dto);
  }

  @Get('my')
  findMy(@CurrentUser() user: User, @Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    return this.worklogService.findMyEntries(user, { startDate, endDate });
  }

  @Get('weekly')
  weekly(@CurrentUser() user: User, @Query('weekStart') weekStart: string) {
    return this.worklogService.getWeeklySummary(user, weekStart);
  }

  @Get('team-report')
  teamReport(
    @CurrentUser() user: User,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.worklogService.getTeamReport(user, { startDate, endDate, teamId });
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: any) {
    return this.worklogService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.worklogService.remove(user, id);
  }
}
