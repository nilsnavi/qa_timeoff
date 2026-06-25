import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { QueryLeaveRequestsDto } from './dto/query-leave-requests.dto';
import { RejectLeaveRequestDto } from './dto/reject-leave-request.dto';
import { LeaveRequestsService } from './leave-requests.service';

@ApiTags('leave-requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get()
  @ApiOperation({ deprecated: true })
  findAll(@CurrentUser() currentUser: User, @Query() query: QueryLeaveRequestsDto) {
    return this.leaveRequestsService.findAll(currentUser, query);
  }

  @Get('summary')
  @ApiOperation({ deprecated: true })
  getTeamSummary(@CurrentUser() currentUser: User) {
    return this.leaveRequestsService.getTeamSummary(currentUser);
  }

  @Get(':id')
  @ApiOperation({ deprecated: true })
  findOne(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.leaveRequestsService.findOne(currentUser, id);
  }

  @Post()
  @ApiOperation({ deprecated: true })
  create(@CurrentUser() currentUser: User, @Body() dto: CreateLeaveRequestDto) {
    return this.leaveRequestsService.create(currentUser, dto);
  }

  @Post(':id/approve')
  @ApiOperation({ deprecated: true })
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  approve(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.leaveRequestsService.approve(currentUser, id);
  }

  @Post(':id/reject')
  @ApiOperation({ deprecated: true })
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  reject(@CurrentUser() currentUser: User, @Param('id') id: string, @Body() dto: RejectLeaveRequestDto) {
    return this.leaveRequestsService.reject(currentUser, id, dto.approverComment);
  }
}
