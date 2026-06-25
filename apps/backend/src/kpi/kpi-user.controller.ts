import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KpiService } from './kpi.service';

@ApiTags('kpi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kpi')
export class KpiUserController {
  constructor(private readonly kpiService: KpiService) {}

  @Get('me')
  getMyKpi(@CurrentUser() user: User) {
    return this.kpiService.findByUser(user.id);
  }
}
