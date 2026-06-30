import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  teamId?: string;
}
