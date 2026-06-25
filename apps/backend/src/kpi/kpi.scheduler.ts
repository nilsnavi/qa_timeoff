import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { KpiService } from './kpi.service';

@Injectable()
export class KpiScheduler {
  private readonly logger = new Logger(KpiScheduler.name);

  constructor(private readonly kpiService: KpiService) {}

  @Cron('0 2 1 * *')
  async recalculateMonthly() {
    this.logger.log('Starting scheduled KPI recalculation...');
    try {
      const result = await this.kpiService.recalculate();
      this.logger.log(`KPI recalculation complete: ${JSON.stringify(result)}`);
    } catch (err) {
      this.logger.error('KPI recalculation failed', err);
    }
  }
}
