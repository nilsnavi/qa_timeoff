import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { TimeOffController } from './timeoff.controller';
import { TimeOffService } from './timeoff.service';

@Module({
  imports: [BalanceModule],
  controllers: [TimeOffController],
  providers: [TimeOffService],
})
export class TimeOffModule {}
