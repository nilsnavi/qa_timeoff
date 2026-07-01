import { Module } from '@nestjs/common';
import { EmployeeBalancesController } from './employee-balances.controller';
import { EmployeeBalancesService } from './employee-balances.service';

@Module({
  controllers: [EmployeeBalancesController],
  providers: [EmployeeBalancesService],
})
export class EmployeeBalancesModule {}
