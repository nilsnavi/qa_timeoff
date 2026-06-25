import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationsDto {
  @IsOptional()
  @IsBoolean()
  notifyRequestUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyTeamRequests?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyEmailDigest?: boolean;
}
