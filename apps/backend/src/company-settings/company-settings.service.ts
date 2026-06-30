import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const settings = await this.prisma.companySettings.findFirst();
    if (!settings) {
      return this.prisma.companySettings.create({ data: {} });
    }
    return settings;
  }

  async update(dto: UpdateCompanySettingsDto) {
    const existing = await this.prisma.companySettings.findFirst();
    if (existing) {
      return this.prisma.companySettings.update({
        where: { id: existing.id },
        data: dto,
      });
    }
    return this.prisma.companySettings.create({ data: dto });
  }
}
