import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateHourlyRateDto {
  @IsInt()
  @Min(0)
  hourlyRate!: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
