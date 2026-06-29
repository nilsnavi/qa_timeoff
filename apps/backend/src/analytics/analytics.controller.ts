import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AnalyticsService, WorkloadQuery } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private parseQuery(query: any): WorkloadQuery {
    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      teamId: query.teamId,
      employeeId: query.employeeId,
      status: query.status ?? 'ALL',
      loadType: query.loadType ?? 'ALL',
      unit: query.unit ?? 'HOURS',
    };
  }

  @Get('workload')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LEAD)
  @ApiOperation({ summary: 'Полная аналитика нагрузки с KPI, рисками, рекомендациями' })
  @ApiQuery({ name: 'dateFrom', required: true })
  @ApiQuery({ name: 'dateTo', required: true })
  getWorkload(@CurrentUser() currentUser: User, @Query() query: any) {
    return this.analyticsService.getWorkload(currentUser, this.parseQuery(query));
  }

  @Get('workload/export/csv')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LEAD)
  @ApiOperation({ summary: 'Экспорт аналитики в CSV' })
  async exportCsv(@CurrentUser() currentUser: User, @Query() query: any, @Res() res: Response) {
    const csv = await this.analyticsService.exportCsv(currentUser, this.parseQuery(query));
    const filename = `workload_analytics_${query.dateFrom}_${query.dateTo}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('workload/export/excel')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LEAD)
  @ApiOperation({ summary: 'Экспорт аналитики в Excel (xlsx)' })
  async exportExcel(@CurrentUser() currentUser: User, @Query() query: any, @Res() res: Response) {
    const buffer = await this.analyticsService.exportExcel(currentUser, this.parseQuery(query));
    const filename = `workload_analytics_${query.dateFrom}_${query.dateTo}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('user/:userId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.LEAD)
  @ApiOperation({ summary: 'Детальная информация по сотруднику' })
  getUserDetail(@CurrentUser() currentUser: User, @Param('userId') userId: string) {
    return this.analyticsService.getUserWorkloadDetail(currentUser, userId);
  }
}
