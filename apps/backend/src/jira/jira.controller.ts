import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { JiraOAuthService } from './jira-oauth.service';
import { JiraSyncService } from './jira-sync.service';
import { JiraWorklogService } from './jira-worklog.service';

@ApiTags('jira')
@Controller('jira')
export class JiraController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: JiraOAuthService,
    private readonly sync: JiraSyncService,
    private readonly worklog: JiraWorklogService,
  ) {}

  @Get('connection')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getConnection(@CurrentUser() user: User) {
    const connection = await this.prisma.jiraConnection.findUnique({
      where: { organizationId: user.organizationId },
      select: {
        status: true, siteUrl: true, selectedProjects: true,
        lastSyncAt: true, lastSyncError: true, syncIntervalMin: true,
      },
    });
    return connection ?? { status: 'DISCONNECTED' };
  }

  @Get('oauth/start')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  startOAuth(@CurrentUser() user: User, @Res() res: Response) {
    const url = this.oauth.buildAuthorizationUrl(user.organizationId);
    res.redirect(url);
  }

  @Get('oauth/callback')
  async oauthCallback(@Query('code') code: string, @Query('state') organizationId: string, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    try {
      const [orgId, userId] = organizationId.split(':');
      await this.oauth.exchangeCodeForTokens(code, orgId, userId);
      res.redirect(`${frontendUrl}/settings/integrations/jira?connected=true`);
    } catch (err: any) {
      res.redirect(`${frontendUrl}/settings/integrations/jira?error=${encodeURIComponent(err.message)}`);
    }
  }

  @Post('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  disconnect(@CurrentUser() user: User) {
    return this.oauth.disconnect(user.organizationId);
  }

  @Post('projects')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async setProjects(@CurrentUser() user: User, @Body() dto: { projectKeys: string[] }) {
    await this.prisma.jiraConnection.update({
      where: { organizationId: user.organizationId },
      data: { selectedProjects: dto.projectKeys },
    });
    return this.sync.syncOrganization(user.organizationId);
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  triggerSync(@CurrentUser() user: User) {
    return this.sync.syncOrganization(user.organizationId);
  }

  @Get('issues/search')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async searchIssues(@CurrentUser() user: User, @Query('q') q: string) {
    if (!q || q.length < 2) return [];
    return this.prisma.jiraIssue.findMany({
      where: {
        organizationId: user.organizationId,
        OR: [
          { issueKey: { contains: q, mode: 'insensitive' } },
          { summary: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 15,
      orderBy: { syncedAt: 'desc' },
    });
  }

  @Get('issues/my')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async myIssues(@CurrentUser() user: User) {
    return this.prisma.jiraIssue.findMany({
      where: { organizationId: user.organizationId, assigneeUserId: user.id },
      orderBy: { syncedAt: 'desc' },
      take: 30,
    });
  }

  @Post('retry-failed')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  retryFailed(@CurrentUser() user: User) {
    return this.worklog.retryFailed(user.organizationId);
  }
}
