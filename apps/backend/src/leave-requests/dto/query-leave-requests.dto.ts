import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryLeaveRequestsDto {
  @IsString()
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @IsString()
  @IsOptional()
  team_id?: string;

  @IsString()
  @IsOptional()
  user_id?: string;

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
