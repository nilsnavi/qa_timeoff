import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryEmployeeBalancesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  @IsIn(['VACATION', 'TIME_OFF', 'SICK_LEAVE', 'UNPAID_LEAVE', 'BUSINESS_TRIP', 'REMOTE_WORK', ''])
  balanceType?: string;

  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  @Type(() => Number)
  period?: number;

  @IsOptional()
  @IsString()
  @IsIn(['NORMAL', 'LOW', 'NEGATIVE', 'HAS_PENDING', ''])
  status?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  problemOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortDir?: string;
}
