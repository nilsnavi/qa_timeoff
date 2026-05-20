import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminService } from './admin.service';
import { BalanceOperationDto } from './dto/balance-operation.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('accruals')
  accrue(@Body() dto: BalanceOperationDto) {
    return this.adminService.accrue(dto.userId, dto.hours, dto.comment);
  }

  @Post('write-offs')
  writeOff(@Body() dto: BalanceOperationDto) {
    return this.adminService.writeOff(dto.userId, dto.hours, dto.comment);
  }
}
