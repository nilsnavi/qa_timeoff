import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusService } from './event-bus.service';
import { SseController } from './sse.controller';
import { SseGateway } from './sse.gateway';

@Global()
@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: (config.get<string>('JWT_EXPIRATION') ?? '24h') as any },
      }),
    }),
  ],
  controllers: [SseController],
  providers: [EventBusService, SseGateway],
  exports: [EventBusService, SseGateway],
})
export class EventsModule {}
