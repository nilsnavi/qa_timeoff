import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleUsersDto } from './dto/update-role-users.dto';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('roles.view')
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isSystem', required: false, type: 'boolean' })
  @ApiQuery({ name: 'isActive', required: false, type: 'boolean' })
  findAll(
    @Query('search') search?: string,
    @Query('isSystem') isSystem?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.rolesService.findAll({
      search,
      isSystem: isSystem !== undefined ? isSystem === 'true' : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('permissions')
  @RequirePermissions('roles.view')
  getPermissions() {
    return this.rolesService.getAllPermissions();
  }

  @Get('permissions/matrix')
  @RequirePermissions('roles.view')
  getPermissionMatrix() {
    return this.rolesService.getPermissionMatrix();
  }

  @Get('kpi')
  @RequirePermissions('roles.view')
  getKpi() {
    return this.rolesService.getKpi();
  }

  @Get(':id')
  @RequirePermissions('roles.view')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @RequirePermissions('roles.create')
  create(@CurrentUser() user: User, @Body() dto: CreateRoleDto) {
    return this.rolesService.create(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('roles.edit')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('roles.delete')
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.rolesService.delete(user, id);
  }

  @Post(':id/clone')
  @RequirePermissions('roles.create')
  clone(@CurrentUser() user: User, @Param('id') id: string, @Body('code') code: string) {
    return this.rolesService.clone(user, id, code);
  }

  @Patch(':id/permissions')
  @RequirePermissions('roles.edit')
  updatePermissions(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.rolesService.updatePermissions(user, id, dto.permissionCodes);
  }

  @Get(':id/users')
  @RequirePermissions('roles.view')
  getUsers(@Param('id') id: string) {
    return this.rolesService.getUsers(id);
  }

  @Post(':id/users')
  @RequirePermissions('roles.assign')
  addUsers(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateRoleUsersDto,
  ) {
    return this.rolesService.addUsers(user, id, dto.userIds);
  }

  @Delete(':id/users/:userId')
  @RequirePermissions('roles.assign')
  removeUser(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.rolesService.removeUser(user, id, userId);
  }

  @Get(':id/audit-log')
  @RequirePermissions('roles.view')
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  getAuditLog(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.rolesService.getAuditLog(
      id,
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
