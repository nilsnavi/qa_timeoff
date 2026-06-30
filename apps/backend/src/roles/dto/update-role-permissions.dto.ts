import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdateRolePermissionsDto {
  @ApiProperty({ description: 'Список кодов прав', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  permissionCodes!: string[];
}
