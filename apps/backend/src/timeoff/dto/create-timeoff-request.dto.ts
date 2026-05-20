import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTimeOffRequestDto {
  @IsDateString()
  date!: string;

  @IsInt()
  @Min(1)
  @Max(24)
  hours!: number;

  @IsString()
  reason!: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
