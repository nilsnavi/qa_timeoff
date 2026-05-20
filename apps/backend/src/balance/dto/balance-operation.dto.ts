import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class BalanceOperationDto {
  @IsString()
  userId!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  hours!: number;

  @IsString()
  @IsOptional()
  reason = 'Manual balance operation';
}
