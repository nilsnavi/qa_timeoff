import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@CurrentUser() currentUser: User) {
    return this.usersService.findAll(currentUser);
  }

  @Get(':id')
  findOne(@CurrentUser() currentUser: User, @Param('id') id: string) {
    return this.usersService.findOne(currentUser, id);
  }

  @Post('import')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Импорт пользователей из CSV' })
  @ApiConsumes('multipart/form-data')
  async importUsers(@CurrentUser() currentUser: User, @Req() req: any) {
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', resolve);
      req.on('error', reject);
    });

    const raw = Buffer.concat(chunks).toString('utf-8');

    let csvText = raw;
    const boundaryMatch = req.headers['content-type']?.match(/boundary=([^\s;]+)/);
    if (boundaryMatch) {
      const boundary = '--' + boundaryMatch[1];
      const parts = raw.split(boundary);
      const dataPart = parts.find(p => p.includes('filename=') || (p.includes('\r\n\r\n') && !p.includes('Content-Disposition') === false));
      if (dataPart) {
        const bodyStart = dataPart.indexOf('\r\n\r\n');
        if (bodyStart !== -1) {
          csvText = dataPart.slice(bodyStart + 4).replace(/\r?\n--$/, '').trim();
        }
      }
    }

    if (!csvText || csvText.length < 5) {
      throw new BadRequestException('Файл не найден или пустой');
    }

    return this.usersService.importFromCsv(csvText, currentUser.organizationId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  create(@CurrentUser() currentUser: User, @Body() dto: CreateUserDto) {
    return this.usersService.create(dto, currentUser.organizationId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch('me/password')
  async changeMyPassword(@CurrentUser() currentUser: User, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(currentUser.id, dto);
  }

  @Patch('me/notifications')
  updateNotifications(@CurrentUser() user: User, @Body() dto: UpdateNotificationsDto) {
    return this.usersService.updateNotifications(user.id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  resetPassword(@Param('id') id: string) {
    return this.usersService.resetPassword(id);
  }
}
