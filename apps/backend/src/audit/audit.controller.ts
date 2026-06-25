import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from './audit.service';

@ApiTags('admin', 'audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.auditService.findAll({
      entityType,
      entityId,
      actorId,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
  }
}
