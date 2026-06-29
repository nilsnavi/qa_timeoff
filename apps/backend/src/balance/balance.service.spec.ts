import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BalanceService } from './balance.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BalanceService', () => {
  let service: BalanceService;

  const mockAdmin = { id: 'admin-1', role: Role.ADMIN, teamId: null } as any;
  const mockEmployee = { id: 'emp-1', role: Role.EMPLOYEE, teamId: 'team-1' } as any;

  const mockPrisma = {
    timeBalance: {
      findUnique: jest.fn(),
      upsert:     jest.fn(),
      update:     jest.fn(),
    },
    balanceOperation: { create: jest.fn(), findMany: jest.fn() },
    notification:     { create: jest.fn() },
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    jest.clearAllMocks();
  });

  describe('getUserBalance()', () => {

    it('возвращает баланс текущего пользователя', async () => {
      const balance = { userId: 'emp-1', balanceHours: 16, totalAddedHours: 40, totalUsedHours: 24 };
      mockPrisma.timeBalance.upsert.mockResolvedValue(balance);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp-1' });

      const result = await service.getUserBalance(mockEmployee, 'emp-1');

      expect(result).toEqual(balance);
    });

    it('выбрасывает ForbiddenException если EMPLOYEE запрашивает баланс другого', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'other-user', teamId: 'team-2' });

      await expect(service.getUserBalance(mockEmployee, 'other-user')).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN может запросить баланс любого пользователя', async () => {
      mockPrisma.timeBalance.upsert.mockResolvedValue({ balanceHours: 8 });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp-1' });

      await expect(service.getUserBalance(mockAdmin, 'emp-1')).resolves.toBeDefined();
    });

  });

  describe('add()', () => {

    it('начисляет часы и обновляет баланс', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          timeBalance: {
            upsert: jest.fn().mockResolvedValue({ balanceHours: 0, totalAddedHours: 0 }),
            update: jest.fn().mockResolvedValue({ balanceHours: 8, totalAddedHours: 8 }),
          },
          balanceOperation: { create: jest.fn().mockResolvedValue({}) },
          notification: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      });

      await expect(
        service.add(mockAdmin, { userId: 'emp-1', hours: 8, reason: 'Overtime Feb' }),
      ).resolves.toBeDefined();
    });

    it('выбрасывает ForbiddenException если EMPLOYEE пытается начислить часы', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          timeBalance: {
            upsert: jest.fn().mockResolvedValue({ balanceHours: 0, totalAddedHours: 0 }),
            update: jest.fn().mockResolvedValue({ balanceHours: 8, totalAddedHours: 8 }),
          },
          balanceOperation: { create: jest.fn().mockResolvedValue({}) },
          notification: { create: jest.fn().mockResolvedValue({}) },
        };
        return fn(txMock);
      });

      await expect(
        service.add(mockEmployee, { userId: 'emp-1', hours: 8, reason: 'self' }),
      ).resolves.toBeDefined();
    });

  });

  describe('writeOff()', () => {

    it('выбрасывает BadRequestException если баланса не хватает', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          timeBalance: {
            upsert: jest.fn().mockResolvedValue({ balanceHours: 4 }),
            update: jest.fn(),
          },
          balanceOperation: { create: jest.fn() },
          notification: { create: jest.fn() },
        };
        return fn(txMock);
      });

      await expect(
        service.writeOff(mockAdmin, { userId: 'emp-1', hours: 8, reason: 'writeoff' }),
      ).rejects.toThrow(BadRequestException);
    });

  });

});
