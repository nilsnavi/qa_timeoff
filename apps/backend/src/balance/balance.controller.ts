import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BalanceOperationDto } from './dto/balance-operation.dto';
import { BalanceService } from './balance.service';

@ApiTags('balance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('me')
  getMyBalance(@CurrentUser() currentUser: User) {
    return this.balanceService.getMyBalance(currentUser.id);
  }

  @Get('user/:userId')
  getUserBalance(@CurrentUser() currentUser: User, @Param('userId') userId: string) {
    return this.balanceService.getUserBalance(currentUser, userId);
  }

  @Post('add')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  add(@CurrentUser() currentUser: User, @Body() dto: BalanceOperationDto) {
    return this.balanceService.add(currentUser, dto);
  }

  @Post('write-off')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN)
  writeOff(@CurrentUser() currentUser: User, @Body() dto: BalanceOperationDto) {
    return this.balanceService.writeOff(currentUser, dto);
  }

  @Get('operations')
  getOperations(@CurrentUser() currentUser: User) {
    return this.balanceService.getOperations(currentUser);
  }

  @Get('operations/:userId')
  getUserOperations(@CurrentUser() currentUser: User, @Param('userId') userId: string) {
    return this.balanceService.getUserOperations(currentUser, userId);
  }

  // ── Time Wallet endpoints ──────────────────────────────────────────

  @Get('history')
  @ApiQuery({ name: 'days', required: false, type: Number })
  getBalanceHistory(@CurrentUser() currentUser: User, @Query('days') days?: number) {
    return this.balanceService.getBalanceHistory(currentUser.id, days ?? 30);
  }

  @Get('summary')
  getBalanceSummary(@CurrentUser() currentUser: User) {
    return this.balanceService.getBalanceSummary(currentUser.id);
  }

  @Get('ledger')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getBalanceLedger(
    @CurrentUser() currentUser: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.balanceService.getBalanceLedger(currentUser.id, page ?? 1, limit ?? 50);
  }
}
