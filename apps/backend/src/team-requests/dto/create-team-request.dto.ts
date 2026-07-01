import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateTeamRequestDto {
  @IsIn(['TIME_OFF', 'VACATION', 'OVERTIME', 'OVERWORK', 'REMOTE_WORK', 'OTHER'])
  type!: string;

  @IsString()
  dateFrom!: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsInt()
  @Min(1)
  @Max(240)
  hours!: number;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;
}
