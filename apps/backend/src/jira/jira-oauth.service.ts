import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';

const JIRA_AUTH_URL = 'https://auth.atlassian.com/authorize';
const JIRA_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const JIRA_ACCESSIBLE_RESOURCES = 'https://api.atlassian.com/oauth/token/accessible-resources';

@Injectable()
export class JiraOAuthService {
  private readonly logger = new Logger(JiraOAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  buildAuthorizationUrl(organizationId: string): string {
    const clientId = this.config.getOrThrow<string>('JIRA_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>('JIRA_REDIRECT_URI');
    const scopes = [
      'read:jira-work',
      'read:jira-user',
      'write:jira-work',
      'offline_access',
    ].join(' ');

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      state: organizationId,
      response_type: 'code',
      prompt: 'consent',
    });

    return `${JIRA_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string, organizationId: string, connectedById: string) {
    const clientId = this.config.getOrThrow<string>('JIRA_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('JIRA_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('JIRA_REDIRECT_URI');

    const tokenResponse = (await firstValueFrom(
      this.http.post(JIRA_TOKEN_URL, {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    )) as any;

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const resourcesResponse = (await firstValueFrom(
      this.http.get(JIRA_ACCESSIBLE_RESOURCES, {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    )) as any;

    const resources = resourcesResponse.data as Array<{ id: string; url: string; name: string }>;
    if (!resources.length) {
      throw new Error('Не найдено доступных Jira-сайтов для этого аккаунта');
    }

    const site = resources[0];

    const expiresAt = new Date(Date.now() + expires_in * 1000);

    return this.prisma.jiraConnection.upsert({
      where: { organizationId },
      create: {
        organizationId,
        cloudId: site.id,
        siteUrl: site.url,
        accessToken: this.encryption.encrypt(access_token),
        refreshToken: this.encryption.encrypt(refresh_token),
        tokenExpiresAt: expiresAt,
        status: 'CONNECTED',
        connectedById,
      },
      update: {
        cloudId: site.id,
        siteUrl: site.url,
        accessToken: this.encryption.encrypt(access_token),
        refreshToken: this.encryption.encrypt(refresh_token),
        tokenExpiresAt: expiresAt,
        status: 'CONNECTED',
        lastSyncError: null,
      },
    });
  }

  async ensureValidToken(organizationId: string): Promise<string> {
    const connection = await this.prisma.jiraConnection.findUnique({ where: { organizationId } });
    if (!connection) throw new Error('Jira не подключена для этой организации');

    if (connection.tokenExpiresAt > new Date(Date.now() + 60_000)) {
      return this.encryption.decrypt(connection.accessToken);
    }

    const clientId = this.config.getOrThrow<string>('JIRA_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('JIRA_CLIENT_SECRET');
    const refreshToken = this.encryption.decrypt(connection.refreshToken);

    try {
      const response = (await firstValueFrom(
        this.http.post(JIRA_TOKEN_URL, {
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      )) as any;

      const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;
      const expiresAt = new Date(Date.now() + expires_in * 1000);

      await this.prisma.jiraConnection.update({
        where: { organizationId },
        data: {
          accessToken: this.encryption.encrypt(access_token),
          refreshToken: this.encryption.encrypt(newRefreshToken ?? refreshToken),
          tokenExpiresAt: expiresAt,
          status: 'CONNECTED',
        },
      });

      return access_token;
    } catch (err) {
      this.logger.error(`Failed to refresh Jira token for org ${organizationId}`, err);
      await this.prisma.jiraConnection.update({
        where: { organizationId },
        data: { status: 'TOKEN_EXPIRED' },
      });
      throw new Error('Сессия Jira истекла. Переподключите интеграцию в настройках.');
    }
  }

  async disconnect(organizationId: string) {
    return this.prisma.jiraConnection.delete({ where: { organizationId } });
  }
}
