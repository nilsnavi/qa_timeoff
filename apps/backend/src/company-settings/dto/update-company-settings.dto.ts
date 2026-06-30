import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateCompanySettingsDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsInt()
  @Min(1)
  @Max(7)
  @IsOptional()
  workWeekDays?: number;

  @IsInt()
  @Min(1)
  @Max(24)
  @IsOptional()
  workingHoursPerDay?: number;

  @IsInt()
  @IsOptional()
  defaultAnnualHours?: number;

  @IsInt()
  @Min(50)
  @Max(100)
  @IsOptional()
  minimumTeamCoveragePercent?: number;

  @IsString()
  @IsOptional()
  approvalPolicy?: string;

  @IsBoolean()
  @IsOptional()
  allowNegativeBalance?: boolean;

  @IsBoolean()
  @IsOptional()
  emailNotificationsEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  telegramNotificationsEnabled?: boolean;
}
