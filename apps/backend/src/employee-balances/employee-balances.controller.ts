import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { QueryEmployeeBalancesDto } from './dto/query-employee-balances.dto';
import { RecalculateBalancesDto } from './dto/recalculate-balances.dto';
import { EmployeeBalancesService } from './employee-balances.service';

@ApiTags('employee-balances')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('balances')
export class EmployeeBalancesController {
  constructor(private readonly service: EmployeeBalancesService) {}

  @Get('employees')
  getEmployeeBalances(@CurrentUser() currentUser: User, @Query() query: QueryEmployeeBalancesDto) {
    return this.service.getEmployeeBalances(currentUser, query);
  }

  @Post('recalculate')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  recalculate(@CurrentUser() _currentUser: User, @Body() dto: RecalculateBalancesDto) {
    return this.service.recalculate();
  }
}
