import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterOrganizationDto {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsString()
  @MinLength(2)
  adminFullName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
