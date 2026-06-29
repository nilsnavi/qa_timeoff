import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SseGateway } from './sse.gateway';
import { Throttle } from '@nestjs/throttler';

@ApiTags('sse')
@Controller('sse')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  constructor(
    private readonly sseGateway: SseGateway,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('leave-requests')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async subscribe(@Query('token') token: string, @Res() res: Response) {
    let user: { id: string; teamId: string | null } | null;
    try {
      const payload = this.jwt.verify(token) as { sub: string; scope?: string };
      // Accept both main JWT and short-lived SSE token
      if (payload.scope && payload.scope !== 'sse') {
        throw new Error('Invalid token scope');
      }
      user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, teamId: true } });
      if (!user) throw new Error();
    } catch {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    if (!this.sseGateway.canAcceptClient(user.id)) {
      res.status(429).json({ message: 'Too many SSE connections. Close existing tabs and try again.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    res.write(`data: ${JSON.stringify({ type: 'connected', userId: user.id })}\n\n`);

    const clientId = `${user.id}-${Date.now()}`;
    this.sseGateway.addClient({ id: clientId, response: res, userId: user.id, teamId: user.teamId ?? undefined });

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
      }
    }, 30000);

    res.on('close', () => {
      clearInterval(keepAlive);
      this.sseGateway.removeClient(clientId);
    });
  }
}
