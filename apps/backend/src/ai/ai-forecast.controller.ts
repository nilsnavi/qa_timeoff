import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiForecastService } from './ai-forecast.service';

@ApiTags('admin', 'ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/ai')
export class AiForecastController {
  constructor(private readonly aiForecastService: AiForecastService) {}

  @Get('overtime-forecast')
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'monthsLookback', required: false })
  getForecast(
    @Query('teamId') teamId?: string,
    @Query('monthsLookback') monthsLookback?: string,
  ) {
    return this.aiForecastService.getOvertimeForecast({
      teamId,
      monthsLookback: monthsLookback ? Number(monthsLookback) : undefined,
    });
  }
}
