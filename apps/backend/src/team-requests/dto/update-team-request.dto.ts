import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateTeamRequestDto {
  @IsOptional()
  @IsString()
  @IsIn(['TIME_OFF', 'VACATION', 'OVERTIME', 'OVERWORK', 'REMOTE_WORK', 'OTHER'])
  type?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(240)
  hours?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
