import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class UpdateRoleUsersDto {
  @ApiProperty({ description: 'Список ID пользователей', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  userIds!: string[];
}
