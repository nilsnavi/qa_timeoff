import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCalendarEventDto {
  @IsString()
  @IsOptional()
  @IsIn(['VACATION', 'TIME_OFF', 'SICK_LEAVE', 'HOLIDAY'])
  type?: 'VACATION' | 'TIME_OFF' | 'SICK_LEAVE' | 'HOLIDAY';

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  comment?: string;
}
