import { Module } from '@nestjs/common';
import { JiraModule } from '../jira/jira.module';
import { WorklogService } from './worklog.service';
import { WorklogController } from './worklog.controller';

@Module({
  imports: [JiraModule],
  controllers: [WorklogController],
  providers: [WorklogService],
})
export class WorklogModule {}
