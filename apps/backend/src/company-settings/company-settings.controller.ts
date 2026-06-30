import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CompanySettingsService } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class CompanySettingsController {
  constructor(private readonly companySettingsService: CompanySettingsService) {}

  @Get('company')
  get() {
    return this.companySettingsService.get();
  }

  @Patch('company')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@CurrentUser() user: User, @Body() dto: UpdateCompanySettingsDto) {
    return this.companySettingsService.update(user, dto);
  }

  @Post('company/test-email')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  testEmail() {
    return { success: false, message: 'SMTP не настроен или не доступен' };
  }

  @Post('company/test-telegram')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  testTelegram() {
    return { success: false, message: 'Telegram бот не настроен' };
  }

  @Get('company/audit')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getAudit() {
    return this.companySettingsService.getAudit();
  }
}
