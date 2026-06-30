import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportStatus, ImportType, Prisma, User, BalanceOperationType } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
}

export interface ValidationError {
  rowNumber: number;
  field: string;
  message: string;
  value: string;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async findAll(params?: { type?: string; status?: string; page?: number; limit?: number }) {
    const where: Prisma.ImportJobWhereInput = {};
    if (params?.type) where.type = params.type as ImportType;
    if (params?.status) where.status = params.status as ImportStatus;
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const [items, total] = await Promise.all([
      this.prisma.importJob.findMany({
        where, orderBy: { createdAt: 'desc' }, take: limit, skip: (page - 1) * limit,
        include: { createdBy: { select: { id: true, fullName: true } } },
      }),
      this.prisma.importJob.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const job = await this.prisma.importJob.findUnique({
      where: { id },
      include: { createdBy: { select: { id: true, fullName: true } }, errors: true },
    });
    if (!job) throw new NotFoundException('Импорт не найден');
    return job;
  }

  async getKpi() {
    const [total, success, failed, lastImport] = await Promise.all([
      this.prisma.importJob.count(),
      this.prisma.importJob.count({ where: { status: 'SUCCESS' } }),
      this.prisma.importJob.count({ where: { status: { in: ['FAILED', 'PARTIAL_SUCCESS'] } } }),
      this.prisma.importJob.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, status: true } }),
    ]);
    return { total, success, failed, lastImport };
  }

  async validateFile(actor: User, type: ImportType, fileBuffer: Buffer, fileName: string): Promise<{
    importJobId: string;
    totalRows: number;
    validRows: number;
    errorCount: number;
    preview: ParsedRow[];
    errors: ValidationError[];
  }> {
    const job = await this.prisma.importJob.create({
      data: { type, status: 'VALIDATING', fileName, createdById: actor.id },
    });

    const safeName = `${job.id}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(UPLOAD_DIR, safeName);
    fs.writeFileSync(filePath, fileBuffer);

    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { originalFilePath: filePath },
    });

    const rows = this.parseFile(fileBuffer, fileName);
    const errors = this.validateRows(type, rows);
    const validCount = rows.length - new Set(errors.map(e => e.rowNumber)).size;
    const errorCount = new Set(errors.map(e => e.rowNumber)).size;

    if (errors.length > 0) {
      await this.prisma.importError.createMany({
        data: errors.map(e => ({
          importJobId: job.id,
          rowNumber: e.rowNumber,
          field: e.field,
          message: e.message,
          rawValue: e.value,
        })),
      });
    }

    await this.prisma.importJob.update({
      where: { id: job.id },
      data: { totalRows: rows.length, validRows: validCount, errorRows: errorCount, status: validCount > 0 ? 'READY' : 'FAILED' },
    });

    await this.auditService.log({
      actorId: actor.id, actorName: actor.fullName, actorRole: actor.role,
      action: 'IMPORT_VALIDATED', entityType: 'IMPORT_JOB', entityId: job.id,
      result: validCount > 0 ? 'SUCCESS' : 'ERROR',
      payload: { type, totalRows: rows.length, validRows: validCount, errors: errorCount },
    });

    return {
      importJobId: job.id, totalRows: rows.length, validRows: validCount, errorCount,
      preview: rows.slice(0, 20), errors,
    };
  }

  async runImport(actor: User, id: string, importOnlyValidRows?: boolean) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Импорт не найден');
    if (job.status !== 'READY') throw new BadRequestException('Импорт не готов к запуску');

    await this.prisma.importJob.update({ where: { id }, data: { status: 'PROCESSING', startedAt: new Date() } });

    await this.auditService.log({
      actorId: actor.id, actorName: actor.fullName, actorRole: actor.role,
      action: 'IMPORT_STARTED', entityType: 'IMPORT_JOB', entityId: id,
      payload: { type: job.type },
    });

    const fileBuffer = fs.readFileSync(job.originalFilePath!);
    const rows = this.parseFile(fileBuffer, job.fileName);
    const errors = this.validateRows(job.type, rows);
    const errorRowNums = importOnlyValidRows ? new Set(errors.map(e => e.rowNumber)) : new Set<number>();
    const validRows = importOnlyValidRows ? rows.filter(r => !errorRowNums.has(r.rowNumber)) : rows;
    const result = await this.processRows(job.type, validRows);

    const status = result.errorRows > 0 ? (result.createdRows + result.updatedRows > 0 ? 'PARTIAL_SUCCESS' : 'FAILED') : 'SUCCESS';

    await this.prisma.importJob.update({
      where: { id },
      data: {
        ...result,
        status,
        finishedAt: new Date(),
      },
    });

    await this.auditService.log({
      actorId: actor.id, actorName: actor.fullName, actorRole: actor.role,
      action: status === 'SUCCESS' ? 'IMPORT_COMPLETED' : status === 'PARTIAL_SUCCESS' ? 'IMPORT_PARTIAL_SUCCESS' : 'IMPORT_FAILED',
      entityType: 'IMPORT_JOB', entityId: id,
      result: status,
      payload: { type: job.type, ...result },
    });

    return this.findOne(id);
  }

  getTemplate(type: ImportType): string {
    switch (type) {
      case 'USERS':
        return 'fullName,email,roleCode,teamName,position,telegramId,isActive';
      case 'TEAMS':
        return 'name,description,leadEmail,isActive';
      case 'BALANCES':
        return 'email,balanceHours,comment';
    }
  }

  private parseFile(buffer: Buffer, fileName: string): ParsedRow[] {
    const ext = path.extname(fileName).toLowerCase();
    if (ext === '.csv') return this.parseCsv(buffer);
    if (ext === '.xlsx') return this.parseXlsx(buffer);
    throw new BadRequestException('Неподдерживаемый формат файла. Используйте CSV или XLSX.');
  }

  private parseCsv(buffer: Buffer): ParsedRow[] {
    const text = buffer.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) throw new BadRequestException('Файл пуст или содержит только заголовок');
    const headers = this.parseCsvLine(lines[0]);
    return lines.slice(1).map((line, idx) => {
      const values = this.parseCsvLine(line);
      const data: Record<string, string> = {};
      headers.forEach((h, i) => { data[h.trim()] = (values[i] ?? '').trim(); });
      return { rowNumber: idx + 2, data };
    });
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  }

  private parseXlsx(buffer: Buffer): ParsedRow[] {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx');
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!json.length) throw new BadRequestException('Файл пуст');
      return json.map((row: any, idx: number) => ({
        rowNumber: idx + 2,
        data: Object.fromEntries(
          Object.entries(row as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '').trim()])
        ),
      }));
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Не удалось прочитать XLSX файл');
    }
  }

  private validateRows(type: ImportType, rows: ParsedRow[]): ValidationError[] {
    switch (type) {
      case 'USERS': return this.validateUserRows(rows);
      case 'TEAMS': return this.validateTeamRows(rows);
      case 'BALANCES': return this.validateBalanceRows(rows);
      default: return [];
    }
  }

  private validateUserRows(rows: ParsedRow[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const seenEmails = new Set<string>();
    for (const row of rows) {
      const email = row.data.email;
      if (!email) { errors.push({ rowNumber: row.rowNumber, field: 'email', message: 'Email обязателен', value: '' }); continue; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ rowNumber: row.rowNumber, field: 'email', message: 'Некорректный email', value: email });
      }
      if (seenEmails.has(email.toLowerCase())) {
        errors.push({ rowNumber: row.rowNumber, field: 'email', message: 'Дублирующий email в файле', value: email });
      }
      seenEmails.add(email.toLowerCase());
      if (!row.data.fullName) {
        errors.push({ rowNumber: row.rowNumber, field: 'fullName', message: 'ФИО обязательно', value: '' });
      }
    }
    return errors;
  }

  private validateTeamRows(rows: ParsedRow[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const seenNames = new Set<string>();
    for (const row of rows) {
      if (!row.data.name) { errors.push({ rowNumber: row.rowNumber, field: 'name', message: 'Название команды обязательно', value: '' }); continue; }
      if (seenNames.has(row.data.name.toLowerCase())) {
        errors.push({ rowNumber: row.rowNumber, field: 'name', message: 'Дублирующее название команды в файле', value: row.data.name });
      }
      seenNames.add(row.data.name.toLowerCase());
    }
    return errors;
  }

  private validateBalanceRows(rows: ParsedRow[]): ValidationError[] {
    const errors: ValidationError[] = [];
    const seenEmails = new Set<string>();
    for (const row of rows) {
      const email = row.data.email;
      if (!email) { errors.push({ rowNumber: row.rowNumber, field: 'email', message: 'Email обязателен', value: '' }); continue; }
      if (seenEmails.has(email.toLowerCase())) {
        errors.push({ rowNumber: row.rowNumber, field: 'email', message: 'Дублирующий email в файле', value: email });
      }
      seenEmails.add(email.toLowerCase());
      const hours = row.data.balanceHours;
      if (!hours) { errors.push({ rowNumber: row.rowNumber, field: 'balanceHours', message: 'Баланс обязателен', value: '' }); continue; }
      if (isNaN(Number(hours)) || Number(hours) < 0) {
        errors.push({ rowNumber: row.rowNumber, field: 'balanceHours', message: 'Значение должно быть неотрицательным числом', value: hours });
      }
    }
    return errors;
  }

  private async processRows(type: ImportType, rows: ParsedRow[]): Promise<{
    createdRows: number; updatedRows: number; skippedRows: number; errorRows: number;
  }> {
    switch (type) {
      case 'USERS': return this.processUserRows(rows);
      case 'TEAMS': return this.processTeamRows(rows);
      case 'BALANCES': return this.processBalanceRows(rows);
      default: return { createdRows: 0, updatedRows: 0, skippedRows: 0, errorRows: 0 };
    }
  }

  private async processUserRows(rows: ParsedRow[]): Promise<{ createdRows: number; updatedRows: number; skippedRows: number; errorRows: number }> {
    let created = 0, updated = 0, errors = 0;
    const skipped = 0;
    const roleMap = new Map<string, string>();
    const roles = await this.prisma.roleModel.findMany({ select: { id: true, code: true } });
    for (const r of roles) roleMap.set(r.code, r.id);
    const teamMap = new Map<string, string>();
    const teams = await this.prisma.team.findMany({ select: { id: true, name: true } });
    for (const t of teams) teamMap.set(t.name.toLowerCase(), t.id);

    for (const row of rows) {
      try {
        const email = row.data.email?.toLowerCase();
        const roleCode = row.data.roleCode || 'EMPLOYEE';
        const teamName = row.data.teamName;
        const roleId = roleMap.get(roleCode);
        const teamId = teamName ? teamMap.get(teamName.toLowerCase()) : null;

        if (teamName && !teamId) { errors++; continue; }

        const existing = await this.prisma.user.findUnique({ where: { email } });
        if (existing) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data: {
              fullName: row.data.fullName || existing.fullName,
              position: row.data.position ?? existing.position,
              isActive: row.data.isActive !== undefined ? row.data.isActive === 'true' : existing.isActive,
              telegramId: row.data.telegramId ?? existing.telegramId,
              ...(roleId ? { roleId } : {}),
              ...(teamId ? { teamId } : {}),
            },
          });
          updated++;
        } else {
          await this.prisma.user.create({
            data: {
              email, fullName: row.data.fullName,
              position: row.data.position ?? '',
              isActive: row.data.isActive !== 'false',
              telegramId: row.data.telegramId || undefined,
              organizationId: (await this.prisma.organization.findFirst())!.id,
              ...(roleId ? { roleId } : {}),
              ...(teamId ? { teamId } : {}),
            },
          });
          created++;
        }
      } catch { errors++; }
    }
    return { createdRows: created, updatedRows: updated, skippedRows: skipped, errorRows: errors };
  }

  private async processTeamRows(rows: ParsedRow[]): Promise<{ createdRows: number; updatedRows: number; skippedRows: number; errorRows: number }> {
    let created = 0, updated = 0, errors = 0;
    for (const row of rows) {
      try {
        const name = row.data.name;
        const existing = await this.prisma.team.findFirst({ where: { name } });
        const leadEmail = row.data.leadEmail;
        let leadId: string | undefined;
        if (leadEmail) {
          const lead = await this.prisma.user.findUnique({ where: { email: leadEmail } });
          if (lead) leadId = lead.id;
        }
        if (existing) {
          await this.prisma.team.update({
            where: { id: existing.id },
            data: { description: row.data.description ?? existing.description, isActive: row.data.isActive !== 'false', ...(leadId ? { leadId } : {}) },
          });
          updated++;
        } else {
          await this.prisma.team.create({
            data: { name, description: row.data.description ?? '', isActive: true, organizationId: (await this.prisma.organization.findFirst())!.id, ...(leadId ? { leadId } : {}) },
          });
          created++;
        }
      } catch { errors++; }
    }
    return { createdRows: created, updatedRows: updated, skippedRows: 0, errorRows: errors };
  }

  private async processBalanceRows(rows: ParsedRow[]): Promise<{ createdRows: number; updatedRows: number; skippedRows: number; errorRows: number }> {
    let created = 0, updated = 0, errors = 0;
    for (const row of rows) {
      try {
        const email = row.data.email?.toLowerCase();
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) { errors++; continue; }
        const hours = parseFloat(row.data.balanceHours);
        let tb = await this.prisma.timeBalance.findUnique({ where: { userId: user.id } });
        const oldValue = tb?.balanceHours ?? 0;
        if (!tb) {
          tb = await this.prisma.timeBalance.create({ data: { userId: user.id } });
          created++;
        } else { updated++; }
        await this.prisma.timeBalance.update({ where: { userId: user.id }, data: { balanceHours: hours } });
        await this.prisma.balanceOperation.create({
          data: {
            userId: user.id,
            operationType: oldValue === 0 ? BalanceOperationType.IMPORT_INITIAL_BALANCE : BalanceOperationType.IMPORT_BALANCE_ADJUSTMENT,
            hours,
            reason: row.data.comment || 'Импорт из файла',
            createdById: (await this.prisma.user.findFirst({ where: { role: 'ADMIN' } }))?.id ?? user.id,
          },
        });
      } catch { errors++; }
    }
    return { createdRows: created, updatedRows: updated, skippedRows: 0, errorRows: errors };
  }
}
