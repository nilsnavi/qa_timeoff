import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TeamRequestsService } from './team-requests.service';
import { CreateTeamRequestDto } from './dto/create-team-request.dto';
import { UpdateTeamRequestDto } from './dto/update-team-request.dto';

@ApiTags('team-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team-requests')
export class TeamRequestsController {
  constructor(private readonly service: TeamRequestsService) {}

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('teamId') teamId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('period') period?: string,
    @Query('employeeId') employeeId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user, {
      teamId,
      status,
      type,
      period,
      employeeId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTeamRequestDto) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateTeamRequestDto) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.remove(user, id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() user: User, @Param('id') id: string, @Body('comment') comment?: string) {
    return this.service.approve(user, id, comment);
  }

  @Post(':id/reject')
  reject(@CurrentUser() user: User, @Param('id') id: string, @Body('comment') comment?: string) {
    return this.service.reject(user, id, comment);
  }

  @Post(':id/reprocess')
  reprocess(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.reprocess(user, id);
  }

  @Get('analytics/stats')
  getStats(@CurrentUser() user: User, @Query('teamId') teamId?: string) {
    return this.service.getStats(user, teamId);
  }

  @Get('analytics/load')
  getTeamLoad(@CurrentUser() user: User, @Query('teamId') teamId?: string) {
    return this.service.getTeamLoad(user, teamId);
  }
}
