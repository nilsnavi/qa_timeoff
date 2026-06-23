import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { BalanceOperationDto } from './dto/balance-operation.dto';
import { CreateOvertimeDto } from './dto/create-overtime.dto';
import { UpdateHourlyRateDto } from './dto/update-hourly-rate.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Balance Operations ─────────────────────────────────────────────

  @Post('accruals')
  accrue(@Body() dto: BalanceOperationDto, @CurrentUser() currentUser: User) {
    return this.adminService.accrue(currentUser, dto.userId, dto.hours, dto.comment);
  }

  @Post('write-offs')
  writeOff(@Body() dto: BalanceOperationDto, @CurrentUser() currentUser: User) {
    return this.adminService.writeOff(currentUser, dto.userId, dto.hours, dto.comment);
  }

  // ── Position Management ────────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Patch('users/:id/position')
  updatePosition(
    @Param('id') userId: string,
    @Body() dto: UpdatePositionDto,
    @CurrentUser() admin: User,
  ) {
    return this.adminService.updatePosition(admin, userId, dto);
  }

  @Roles(Role.ADMIN)
  @Get('users/:id/position-history')
  getPositionHistory(@Param('id') userId: string) {
    return this.adminService.getPositionHistory(userId);
  }

  // ── Hourly Rate ────────────────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Patch('users/:id/hourly-rate')
  updateHourlyRate(
    @Param('id') userId: string,
    @Body() dto: UpdateHourlyRateDto,
    @CurrentUser() admin: User,
  ) {
    return this.adminService.updateHourlyRate(admin, userId, dto);
  }

  // ── Overtime Management ────────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Post('overtime')
  addOvertime(@Body() dto: CreateOvertimeDto, @CurrentUser() admin: User) {
    return this.adminService.addOvertime(admin, dto);
  }

  @Roles(Role.ADMIN)
  @Get('overtime')
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  getAllOvertime(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.adminService.getAllOvertime({ startDate, endDate, teamId, userId });
  }

  @Roles(Role.ADMIN)
  @Get('overtime/user/:id')
  getUserOvertime(@Param('id') userId: string) {
    return this.adminService.getUserOvertime(userId);
  }

  @Roles(Role.ADMIN)
  @Patch('overtime/:id/cancel')
  cancelOvertime(@Param('id') id: string, @CurrentUser() admin: User) {
    return this.adminService.cancelOvertime(admin, id);
  }

  @Roles(Role.ADMIN)
  @Get('overtime/calendar')
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  getOvertimeCalendar(
    @Query('userId') userId?: string,
    @Query('teamId') teamId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.adminService.getOvertimeCalendar(
      userId,
      teamId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  // ── Reports ────────────────────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Get('reports/overtime')
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getOvertimeReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getOvertimeReport(startDate, endDate);
  }

  @Roles(Role.ADMIN)
  @Get('reports/payroll')
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  getPayrollReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getPayrollReport(startDate, endDate);
  }

  // ── Audit Log ───────────────────────────────────────────────────────

  @Roles(Role.ADMIN)
  @Get('audit-log')
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  getAuditLog(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.adminService.getAuditLog({ entityType, entityId });
  }
}
