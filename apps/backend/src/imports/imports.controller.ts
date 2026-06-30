import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ImportType, Role, User } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RunImportDto } from './dto/run-import.dto';
import { ValidateImportDto } from './dto/validate-import.dto';
import { ImportsService } from './imports.service';
import * as fs from 'fs';

@ApiTags('imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Get()
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('type') type?: string, @Query('status') status?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.importsService.findAll({ type, status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined });
  }

  @Get('kpi')
  getKpi() { return this.importsService.getKpi(); }

  @Get('templates/:type')
  getTemplate(@Param('type') type: string, @Res() res: Response) {
    const t = type.toUpperCase() as ImportType;
    const csv = this.importsService.getTemplate(t);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="template-${type}.csv"`);
    res.send(csv);
  }

  @Post('validate')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async validate(
    @CurrentUser() user: User,
    @Body() dto: ValidateImportDto,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new Error('Файл не загружен');
    return this.importsService.validateFile(user, dto.type, file.buffer, file.originalname);
  }

  @Post(':id/run')
  run(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: RunImportDto) {
    return this.importsService.runImport(user, id, dto.importOnlyValidRows);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.importsService.findOne(id); }

  @Get(':id/errors')
  getErrors(@Param('id') id: string) {
    return this.importsService.findOne(id).then(j => (j as any).errors ?? []);
  }

  @Get(':id/errors/download')
  async downloadErrors(@Param('id') id: string, @Res() res: Response) {
    const job = await this.importsService.findOne(id);
    const header = 'Строка,Поле,Ошибка,Значение\n';
    const rows = ((job as any).errors ?? []).map((e: any) => `"${e.rowNumber}","${e.field ?? ''}","${e.message}","${e.rawValue ?? ''}"`).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="errors-${id}.csv"`);
    res.send(header + rows);
  }

  @Get(':id/source/download')
  downloadSource(@Param('id') id: string, @Res() res: Response) {
    this.importsService.findOne(id).then(job => {
      if (!job.originalFilePath || !fs.existsSync(job.originalFilePath)) {
        res.status(404).json({ message: 'Исходный файл не найден' });
        return;
      }
      res.setHeader('Content-Disposition', `attachment; filename="${job.fileName}"`);
      res.sendFile(job.originalFilePath!);
    });
  }
}
