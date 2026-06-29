import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('admin', 'analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('workload')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LEAD)
  @ApiOperation({ summary: 'Нагрузка сотрудников с рисками, аномалиями и рекомендациями' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'status', required: false })
  getWorkload(
    @CurrentUser() currentUser: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
    @Query('status') status?: string,
  ) {
    return this.analyticsService.getWorkload(currentUser, { startDate, endDate, teamId, userId, status });
  }

  @Get('user/:userId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LEAD)
  @ApiOperation({ summary: 'Детальная информация по сотруднику' })
  getUserDetail(@CurrentUser() currentUser: User, @Param('userId') userId: string) {
    return this.analyticsService.getUserWorkloadDetail(currentUser, userId);
  }
}
