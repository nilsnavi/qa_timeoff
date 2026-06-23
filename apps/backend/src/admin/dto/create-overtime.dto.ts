import { IsDateString, IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateOvertimeDto {
  @IsString()
  userId!: string;

  @IsInt()
  @Min(1)
  hours!: number;

  @IsDateString()
  date!: string;

  @IsString()
  @MinLength(1)
  reason!: string;
}
