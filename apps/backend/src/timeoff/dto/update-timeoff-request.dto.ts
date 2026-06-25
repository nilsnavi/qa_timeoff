import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTimeOffRequestDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(24)
  hours?: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
