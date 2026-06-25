import { IsArray, IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTimeOffBatchDto {
  @IsArray()
  @IsDateString({}, { each: true })
  dates!: string[];

  @IsNumber()
  @Min(1)
  @Max(24)
  hours!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
