import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { EncryptionService } from '../common/crypto/encryption.service';
import { JiraOAuthService } from './jira-oauth.service';
import { JiraSyncService } from './jira-sync.service';
import { JiraWorklogService } from './jira-worklog.service';
import { JiraController } from './jira.controller';

@Module({
  imports: [HttpModule],
  controllers: [JiraController],
  providers: [EncryptionService, JiraOAuthService, JiraSyncService, JiraWorklogService],
  exports: [JiraWorklogService],
})
export class JiraModule {}
