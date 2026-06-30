import { IsBoolean, IsOptional } from 'class-validator';

export class RunImportDto {
  @IsOptional()
  @IsBoolean()
  importOnlyValidRows?: boolean;
}
