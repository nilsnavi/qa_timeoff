import { IsInt, Max, Min } from 'class-validator';

export class RecalculateBalancesDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  period!: number;
}
