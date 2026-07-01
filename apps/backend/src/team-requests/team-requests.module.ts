import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TeamRequestsController } from './team-requests.controller';
import { TeamRequestsService } from './team-requests.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TeamRequestsController],
  providers: [TeamRequestsService],
  exports: [TeamRequestsService],
})
export class TeamRequestsModule {}
