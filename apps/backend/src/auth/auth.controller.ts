import { Body, Controller, Get, Logger, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { CurrentUser } from './current-user.decorator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RegisterOrganizationDto } from './dto/register-organization.dto';

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

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) { }

  private readonly REFRESH_COOKIE = 'refresh_token';
  private readonly REFRESH_PATH = '/api/auth';

  private cookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax' | 'strict';
    path: string;
    maxAge: number;
  } {
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days default
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: this.REFRESH_PATH,
      maxAge: maxAgeMs,
    };
  }

  // POST /auth/telegram — вход через Telegram Mini App initData.
  // Включается только при ENABLE_TELEGRAM_AUTH=true в .env.
  @Post('telegram')
  async telegram(@Body() dto: TelegramAuthDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.telegramLogin(dto.initData);
    res.cookie(this.REFRESH_COOKIE, result.refreshToken, this.cookieOptions());
    return result;
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    res.cookie(this.REFRESH_COOKIE, result.refreshToken, this.cookieOptions());
    return result;
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({ summary: 'Регистрация новой организации с первым администратором' })
  async register(@Body() dto: RegisterOrganizationDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.registerOrganization(dto);
    res.cookie(this.REFRESH_COOKIE, result.refreshToken, this.cookieOptions());
    return result;
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.REFRESH_COOKIE] ?? dto.refreshToken;
    if (!token) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const result = await this.authService.refreshTokens(token);
    res.cookie(this.REFRESH_COOKIE, result.refreshToken, this.cookieOptions());
    return result;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Body() dto: LogoutDto, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[this.REFRESH_COOKIE] ?? dto.refreshToken;
    if (token) {
      await this.authService.logout(token);
    }
    res.clearCookie(this.REFRESH_COOKIE, { path: this.REFRESH_PATH });
  }

  @Post('sse-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Получить короткоживущий токен для SSE-подключения' })
  async getSseToken(@CurrentUser() user: User) {
    const token = await this.jwtService.signAsync(
      { sub: user.id, scope: 'sse' },
      { expiresIn: '5m' },
    );
    return { token };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }
}
