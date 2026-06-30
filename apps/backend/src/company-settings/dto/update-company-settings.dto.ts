import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateCompanySettingsDto {
  @ApiPropertyOptional() @IsString() @IsOptional() companyName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() logoUrl?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() timezone?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() locale?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() dateFormat?: string;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(7) @IsOptional() workWeekDays?: number;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(24) @IsOptional() workingHoursPerDay?: number;
  @ApiPropertyOptional() @IsInt() @Min(1) @Max(7) @IsOptional() workingDaysPerWeek?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() defaultAnnualHours?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @Max(100) @IsOptional() minimumTeamCoveragePercent?: number;
  @ApiPropertyOptional() @IsInt() @Min(0) @IsOptional() minimumBalanceHours?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() approvalPolicy?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() requireRejectComment?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() blockApprovalOnCoverageRisk?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() countPendingAsCoverageRisk?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() allowNegativeBalance?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() emailNotificationsEnabled?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() telegramNotificationsEnabled?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() inAppNotificationsEnabled?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() notifyNewRequest?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() notifyApproval?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() notifyRejection?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() notifyLowBalance?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() notifyCoverageRisk?: boolean;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() notifyOverdueRequests?: boolean;
  @ApiPropertyOptional() @IsString() @IsOptional() smtpHost?: string;
  @ApiPropertyOptional() @IsInt() @IsOptional() smtpPort?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() smtpUser?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() smtpFrom?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() smtpPassword?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() telegramBotToken?: string;
  @ApiPropertyOptional() @IsBoolean() @IsOptional() telegramBotEnabled?: boolean;
}
