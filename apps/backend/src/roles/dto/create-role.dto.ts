import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ description: 'Уникальный код роли', example: 'QA_COORDINATOR' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: 'Название роли', example: 'Координатор QA' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: 'Описание роли' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Код базовой роли для копирования прав' })
  @IsOptional()
  @IsString()
  basedOnRoleCode?: string;

  @ApiPropertyOptional({ description: 'Активна ли роль', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Список кодов прав для роли', type: [String] })
  @IsOptional()
  permissionCodes?: string[];
}
