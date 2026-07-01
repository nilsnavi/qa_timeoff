import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ApprovalScheduler } from './approval-scheduler.service';
import { TeamRequestsController } from './team-requests.controller';
import { TeamRequestsService } from './team-requests.service';

@Module({
  imports: [PrismaModule, AuditModule, EventsModule],
  controllers: [TeamRequestsController],
  providers: [TeamRequestsService, ApprovalScheduler],
  exports: [TeamRequestsService],
})
export class TeamRequestsModule {}
