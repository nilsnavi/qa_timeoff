import { IsDefined, IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class BalanceOperationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(240)
  hours!: number;

  @IsString()
  @IsNotEmpty()
  comment!: string;
}
