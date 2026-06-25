import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class HolidaysService {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async getHolidays(year: number): Promise<string[]> {
    const cacheKey = `holidays:${year}`;

    const cached = await this.cache.get<string>(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const url = `https://isdayoff.ru/api/getdata?year=${year}&delimeter=%0A&pre=0`;

    try {
      const response = await fetch(url);
      const text = await response.text();
      const days = text.split('\n').filter(Boolean);

      const holidays: string[] = [];
      for (let i = 0; i < days.length; i++) {
        if (days[i] === '1') {
          const date = new Date(year, 0, i + 1);
          const dow = date.getDay();
          if (dow !== 0 && dow !== 6) {
            holidays.push(date.toISOString().slice(0, 10));
          }
        }
      }

      await this.cache.set(cacheKey, JSON.stringify(holidays), 86400 * 30);
      this.logger.log(`Loaded ${holidays.length} holidays for ${year}`);

      return holidays;
    } catch (error) {
      this.logger.error(`Failed to fetch holidays for ${year}: ${error}`);
      return [];
    }
  }
}
