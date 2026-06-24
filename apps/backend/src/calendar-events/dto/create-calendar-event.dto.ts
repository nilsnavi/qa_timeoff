import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCalendarEventDto {
  @IsString()
  @IsIn(['VACATION', 'TIME_OFF', 'SICK_LEAVE', 'HOLIDAY'])
  type!: 'VACATION' | 'TIME_OFF' | 'SICK_LEAVE' | 'HOLIDAY';

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  comment?: string;
}
