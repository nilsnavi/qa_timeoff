import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ExportService } from './export.service';

@ApiTags('admin', 'export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('overtime.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="overtime.csv"')
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async exportOvertimeCsv(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportOvertimeCsv({ startDate, endDate, teamId, userId });
    if (res) {
      res.send(csv);
    }
    return csv;
  }

  @Get('payroll.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="payroll.csv"')
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async exportPayrollCsv(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportPayrollCsv({ startDate, endDate, teamId, userId });
    if (res) {
      res.send(csv);
    }
    return csv;
  }

  @Get('kpi.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="kpi.csv"')
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  async exportKpiCsv(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.exportKpiCsv({
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
    if (res) {
      res.send(csv);
    }
    return csv;
  }

  @Get('1c/overtime.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="1c_overtime.csv"')
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async export1cOvertimeCsv(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.export1cOvertimeCsv({ startDate, endDate, teamId, userId });
    if (res) {
      res.send(csv);
    }
    return csv;
  }

  @Get('1c/payroll.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="1c_payroll.csv"')
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async export1cPayrollCsv(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('teamId') teamId?: string,
    @Query('userId') userId?: string,
    @Res() res?: Response,
  ) {
    const csv = await this.exportService.export1cPayrollCsv({ startDate, endDate, teamId, userId });
    if (res) {
      res.send(csv);
    }
    return csv;
  }
}
