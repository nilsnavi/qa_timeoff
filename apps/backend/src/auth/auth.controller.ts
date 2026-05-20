import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { IsString } from 'class-validator';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class TelegramAuthDto {
  @IsString()
  initData!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  telegram(@Body() dto: TelegramAuthDto) {
    return this.authService.telegramLogin(dto.initData);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }
}
