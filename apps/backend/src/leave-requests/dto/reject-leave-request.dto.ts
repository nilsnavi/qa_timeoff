import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectLeaveRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  approverComment?: string;
}
