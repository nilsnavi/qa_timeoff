import { Body, Controller, Get, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

class TelegramAuthDto {
  @IsString()
  initData!: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

class LogoutDto {
  @IsString()
  refreshToken!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) { }

  // POST /auth/telegram — вход через Telegram Mini App initData.
  // Включается только при ENABLE_TELEGRAM_AUTH=true в .env.
  @Post('telegram')
  telegram(@Body() dto: TelegramAuthDto) {
    this.logger.log(`Telegram auth request received`);
    this.logger.log(`initData length: ${dto.initData?.length ?? 0}`);
    return this.authService.telegramLogin(dto.initData);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }
}
