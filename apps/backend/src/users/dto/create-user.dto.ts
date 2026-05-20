import { ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  telegramId!: string;

  @IsString()
  fullName!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  managerId?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
