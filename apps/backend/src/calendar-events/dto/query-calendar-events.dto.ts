import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryCalendarEventsDto {
  @IsString()
  @IsOptional()
  month?: string;

  @IsString()
  @IsOptional()
  team_id?: string;

  @IsString()
  @IsOptional()
  user_id?: string;

  @IsString()
  @IsOptional()
  @IsIn(['VACATION', 'TIME_OFF', 'SICK_LEAVE', 'HOLIDAY'])
  type?: 'VACATION' | 'TIME_OFF' | 'SICK_LEAVE' | 'HOLIDAY';

  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}
