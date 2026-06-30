import { IsEnum, IsNotEmpty } from 'class-validator';
import { ImportType } from '@prisma/client';

export class ValidateImportDto {
  @IsEnum(ImportType)
  @IsNotEmpty()
  type!: ImportType;
}
