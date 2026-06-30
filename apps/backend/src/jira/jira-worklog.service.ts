import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { JiraOAuthService } from './jira-oauth.service';

@Injectable()
export class JiraWorklogService {
  private readonly logger = new Logger(JiraWorklogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly oauth: JiraOAuthService,
  ) {}

  async pushToJira(worklogEntryId: string) {
    const entry = await this.prisma.worklogEntry.findUnique({
      where: { id: worklogEntryId },
      include: { jiraIssue: true, user: true },
    });

    if (!entry || !entry.jiraIssue) return;

    try {
      const connection = await this.prisma.jiraConnection.findUnique({
        where: { organizationId: entry.organizationId },
      });
      if (!connection) throw new Error('Jira не подключена');

      const accessToken = await this.oauth.ensureValidToken(entry.organizationId);

      const response = (await firstValueFrom(
        this.http.post(
          `${connection.siteUrl}/rest/api/3/issue/${entry.jiraIssue.issueKey}/worklog`,
          {
            timeSpentSeconds: Math.round(entry.hours * 3600),
            started: `${entry.date.toISOString().slice(0, 10)}T09:00:00.000+0000`,
            comment: entry.comment
              ? {
                  type: 'doc',
                  version: 1,
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: entry.comment }] }],
                }
              : undefined,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      )) as any;

      await this.prisma.worklogEntry.update({
        where: { id: worklogEntryId },
        data: {
          syncStatus: 'SYNCED',
          jiraWorklogId: response.data.id,
          syncedAt: new Date(),
          syncError: null,
        },
      });
    } catch (err: any) {
      const message = err?.response?.data?.errorMessages?.join(', ') ?? err?.message ?? 'Unknown error';
      this.logger.error(`Failed to push worklog ${worklogEntryId} to Jira: ${message}`);

      await this.prisma.worklogEntry.update({
        where: { id: worklogEntryId },
        data: { syncStatus: 'FAILED', syncError: message },
      });
    }
  }

  async retryFailed(organizationId: string) {
    const failed = await this.prisma.worklogEntry.findMany({
      where: { organizationId, syncStatus: 'FAILED' },
      take: 50,
    });
    for (const entry of failed) {
      await this.pushToJira(entry.id);
    }
    return { retried: failed.length };
  }
}
