import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateTimeOffRequestDto } from './dto/create-timeoff-request.dto';
import { RejectTimeOffRequestDto } from './dto/reject-timeoff-request.dto';
import { TimeOffService } from './timeoff.service';

@ApiTags('timeoff')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timeoff')
export class TimeOffController {
  constructor(private readonly timeOffService: TimeOffService) {}

  @Post('request')
  create(@CurrentUser() currentUser: User, @Body() dto: CreateTimeOffRequestDto) {
    return this.timeOffService.create(currentUser, dto);
  }

  @Get('my')
  getMyRequests(@CurrentUser() currentUser: User) {
    return this.timeOffService.getMyRequests(currentUser.id);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  getPending(@CurrentUser() currentUser: User) {
    return this.timeOffService.getPending(currentUser);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  approve(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.timeOffService.approve(currentUser, id);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  reject(@CurrentUser() currentUser: User, @Param('id') id: string, @Body() dto: RejectTimeOffRequestDto) {
    return this.timeOffService.reject(currentUser, id, dto.approverComment);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.timeOffService.cancel(currentUser, id);
  }
}
