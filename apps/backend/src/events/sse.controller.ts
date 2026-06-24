import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SseGateway } from './sse.gateway';
import { Throttle } from '@nestjs/throttler';

@ApiTags('sse')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sse')
export class SseController {
  constructor(private readonly sseGateway: SseGateway) {}

  @Get('leave-requests')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  subscribe(@CurrentUser() user: User, @Res() res: Response) {
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
