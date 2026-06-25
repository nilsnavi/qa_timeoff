import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ActiveUserGuard } from './active-user.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TelegramAuthService } from './telegram-auth.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRATION') ?? '24h') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TelegramAuthService, ActiveUserGuard],
  exports: [AuthService, JwtService, JwtStrategy, PassportModule, ActiveUserGuard],
})
export class AuthModule {}
