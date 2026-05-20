import { ApiPropertyOptional } from '@nestjs/swagger';
import { VacationType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateVacationRequestDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ enum: VacationType })
  @IsEnum(VacationType)
  @IsOptional()
  vacationType: VacationType = VacationType.ANNUAL;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  comment?: string;
}
