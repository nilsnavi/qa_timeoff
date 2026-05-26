import { Controller, Get } from '@nestjs/common';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckError,
  HealthIndicatorResult,
  HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.databaseIndicator(), () => this.memoryIndicator(), () => this.diskIndicator()]);
  }

  @Get('db')
  @HealthCheck()
  checkDb(): Promise<HealthCheckResult> {
    return this.health.check([() => this.databaseIndicator()]);
  }

  @Get('memory')
  @HealthCheck()
  checkMemory(): Promise<HealthCheckResult> {
    return this.health.check([() => this.memoryIndicator()]);
  }

  private async databaseIndicator(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        database: {
          status: 'up' as const,
        },
      };
    } catch (error) {
      throw new HealthCheckError('Database check failed', {
        database: {
          status: 'down',
          message: error instanceof Error ? error.message : 'unknown database error',
        },
      });
    }
  }

  private memoryIndicator() {
    return this.memory.checkHeap('memory_heap', 250 * 1024 * 1024);
  }

  private diskIndicator() {
    return this.disk.checkStorage('storage', {
      path: process.platform === 'win32' ? 'C:\\' : '/',
      thresholdPercent: 0.9,
    });
  }
}

