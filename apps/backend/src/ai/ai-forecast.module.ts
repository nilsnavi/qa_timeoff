import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiForecastController } from './ai-forecast.controller';
import { AiForecastService } from './ai-forecast.service';

@Module({
  imports: [PrismaModule],
  controllers: [AiForecastController],
  providers: [AiForecastService],
})
export class AiModule {}
