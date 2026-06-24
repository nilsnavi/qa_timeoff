import { IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString()
  @IsIn(['TIME_OFF', 'VACATION'])
  type!: 'TIME_OFF' | 'VACATION';

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsInt()
  @Min(1)
  @Max(176)
  hours!: number;

  @IsString()
  reason!: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
