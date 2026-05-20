import { IsInt, IsString, Max, Min } from 'class-validator';

export class BalanceOperationDto {
  @IsString()
  userId!: string;

  @IsInt()
  @Min(1)
  @Max(240)
  hours!: number;

  @IsString()
  comment!: string;
}
