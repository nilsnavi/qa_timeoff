import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { JiraOAuthService } from './jira-oauth.service';

@Injectable()
export class JiraSyncService {
  private readonly logger = new Logger(JiraSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly oauth: JiraOAuthService,
  ) {}

  @Cron('*/15 * * * *')
  async syncAllOrganizations() {
    const connections = await this.prisma.jiraConnection.findMany({
      where: { status: 'CONNECTED' },
    });

    for (const connection of connections) {
      try {
        await this.syncOrganization(connection.organizationId);
      } catch (err) {
        this.logger.error(`Sync failed for org ${connection.organizationId}`, err);
      }
    }
  }

  async syncOrganization(organizationId: string) {
    const connection = await this.prisma.jiraConnection.findUnique({ where: { organizationId } });
    if (!connection || connection.selectedProjects.length === 0) return;

    const accessToken = await this.oauth.ensureValidToken(organizationId);
    const projectsJql = connection.selectedProjects.map((p: string) => `project = "${p}"`).join(' OR ');
    const jql = `(${projectsJql}) AND assignee is not EMPTY ORDER BY updated DESC`;

    let startAt = 0;
    const maxResults = 100;
    let allIssues: any[] = [];

    while (true) {
      const response = (await firstValueFrom(
        this.http.get(`${connection.siteUrl}/rest/api/3/search`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          params: {
            jql,
            startAt,
            maxResults,
            fields: 'summary,status,issuetype,assignee,project',
          },
        }),
      )) as any;

      allIssues = allIssues.concat(response.data.issues);
      if (response.data.issues.length < maxResults) break;
      startAt += maxResults;
      if (startAt > 1000) break;
    }

    const orgUsers = await this.prisma.user.findMany({
      where: { organizationId },
      select: { id: true, email: true },
    });
    const emailToUserId = new Map(orgUsers.filter(u => u.email).map(u => [u.email!.toLowerCase(), u.id]));

    for (const issue of allIssues) {
      const assigneeEmail = issue.fields.assignee?.emailAddress?.toLowerCase() ?? null;
      const assigneeUserId = assigneeEmail ? emailToUserId.get(assigneeEmail) ?? null : null;

      await this.prisma.jiraIssue.upsert({
        where: { organizationId_issueKey: { organizationId, issueKey: issue.key } },
        create: {
          organizationId,
          jiraIssueId: issue.id,
          issueKey: issue.key,
          projectKey: issue.fields.project.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          issueType: issue.fields.issuetype.name,
          assigneeEmail,
          assigneeUserId,
          url: `${connection.siteUrl}/browse/${issue.key}`,
        },
        update: {
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          assigneeEmail,
          assigneeUserId,
          syncedAt: new Date(),
        },
      });
    }

    await this.prisma.jiraConnection.update({
      where: { organizationId },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });

    this.logger.log(`Synced ${allIssues.length} issues for org ${organizationId}`);
  }
}
