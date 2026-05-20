import { IsOptional, IsString } from 'class-validator';

export class RejectTimeOffRequestDto {
  @IsString()
  @IsOptional()
  approverComment?: string;
}
