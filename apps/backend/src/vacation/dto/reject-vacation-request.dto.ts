import { IsOptional, IsString } from 'class-validator';

export class RejectVacationRequestDto {
  @IsString()
  @IsOptional()
  approverComment?: string;
}
