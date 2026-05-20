import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRequestDto {
  @ApiProperty()
  @IsDateString()
  date!: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsInt()
  @Min(1)
  @Max(240)
  hours!: number;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  reason = '';
}
