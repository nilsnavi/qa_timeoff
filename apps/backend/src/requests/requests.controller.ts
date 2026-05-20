import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateRequestDto } from './dto/create-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateRequestDto) {
    return this.requestsService.create(user.id, dto);
  }

  @Patch(':id/review')
  @UseGuards(RolesGuard)
  @Roles(Role.LEAD, Role.MANAGER, Role.ADMIN)
  review(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: ReviewRequestDto) {
    return this.requestsService.review(user.id, id, dto.status);
  }
}
