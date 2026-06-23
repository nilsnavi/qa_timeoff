import { IsString, MinLength } from 'class-validator';

export class UpdatePositionDto {
  @IsString()
  @MinLength(1)
  position!: string;
}
