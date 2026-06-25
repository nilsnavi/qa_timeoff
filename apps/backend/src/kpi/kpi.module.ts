import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { KpiUserController } from './kpi-user.controller';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';
import { KpiScheduler } from './kpi.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [KpiController, KpiUserController],
  providers: [KpiService, KpiScheduler],
  exports: [KpiService],
})
export class KpiModule {}
