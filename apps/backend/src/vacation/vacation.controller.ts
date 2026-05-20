import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVacationRequestDto } from './dto/create-vacation-request.dto';
import { RejectVacationRequestDto } from './dto/reject-vacation-request.dto';
import { VacationService } from './vacation.service';

@ApiTags('vacation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vacation')
export class VacationController {
  constructor(private readonly vacationService: VacationService) {}

  @Post('request')
  create(@CurrentUser() currentUser: User, @Body() dto: CreateVacationRequestDto) {
    return this.vacationService.create(currentUser, dto);
  }

  @Get('my')
  getMyRequests(@CurrentUser() currentUser: User) {
    return this.vacationService.getMyRequests(currentUser.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  getPending(@CurrentUser() currentUser: User) {
    return this.vacationService.getPending(currentUser);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  approve(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.vacationService.approve(currentUser, id);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  reject(@CurrentUser() currentUser: User, @Param('id') id: string, @Body() dto: RejectVacationRequestDto) {
    return this.vacationService.reject(currentUser, id, dto.approverComment);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.vacationService.cancel(currentUser, id);
  }
}
