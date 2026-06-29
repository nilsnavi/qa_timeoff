import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestStatus, Role } from '@prisma/client';
import { TimeOffService } from './timeoff.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { EmailNotificationService } from '../notifications/email-notification.service';

describe('TimeOffService', () => {
  let service: TimeOffService;

  const mockManager = {
    id: 'manager-1',
    fullName: 'Менеджер Тест',
    role: Role.MANAGER,
    teamId: 'team-1',
  } as any;

  const mockEmployee = {
    id: 'employee-1',
    fullName: 'Сотрудник Тест',
    role: Role.EMPLOYEE,
    teamId: 'team-1',
  } as any;

  const mockPendingRequest = {
    id: 'req-1',
    userId: 'employee-1',
    hours: 8,
    date: new Date('2026-07-01'),
    status: RequestStatus.PENDING,
    user: { id: 'employee-1', fullName: 'Сотрудник', role: Role.EMPLOYEE, teamId: 'team-1' },
  };

  const mockPrisma = {
    timeOffRequest: {
      findUnique: jest.fn(),
      findMany:   jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
    },
    timeBalance: {
      findUnique: jest.fn(),
      upsert:     jest.fn(),
      update:     jest.fn(),
    },
    balanceOperation: { create: jest.fn() },
    notification:     { create: jest.fn(), createMany: jest.fn() },
    user:             { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockEventBus   = { emit: jest.fn() };
  const mockEmailSvc   = { sendRequestApproved: jest.fn(), sendRequestRejected: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeOffService,
        { provide: PrismaService,              useValue: mockPrisma    },
        { provide: EventBusService,            useValue: mockEventBus  },
        { provide: EmailNotificationService,   useValue: mockEmailSvc  },
      ],
    }).compile();

    service = module.get<TimeOffService>(TimeOffService);
    jest.clearAllMocks();
  });

  // ─── approve() ────────────────────────────────────────────────────────────

  describe('approve()', () => {

    it('одобряет pending-заявку и списывает часы с баланса', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue(mockPendingRequest);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          timeBalance: {
            upsert: jest.fn().mockResolvedValue({ balanceHours: 16 }),
            update: jest.fn().mockResolvedValue({}),
          },
          balanceOperation: { create: jest.fn().mockResolvedValue({}) },
          timeOffRequest: {
            update: jest.fn().mockResolvedValue({
              ...mockPendingRequest,
              status: RequestStatus.APPROVED,
              approverId: mockManager.id,
            }),
          },
        };
        return fn(txMock);
      });
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.approve(mockManager, 'req-1');

      expect(result.status).toBe(RequestStatus.APPROVED);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'leave-request.approved',
        expect.objectContaining({ type: 'TIMEOFF_APPROVED' }),
      );
    });

    it('выбрасывает NotFoundException если заявка не найдена', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue(null);

      await expect(service.approve(mockManager, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('выбрасывает ForbiddenException если пытается одобрить EMPLOYEE', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue(mockPendingRequest);

      await expect(service.approve(mockEmployee, 'req-1')).rejects.toThrow(ForbiddenException);
    });

    it('выбрасывает BadRequestException если баланс недостаточен', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue(mockPendingRequest);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          timeBalance: {
            upsert: jest.fn().mockResolvedValue({ balanceHours: 4 }),
            update: jest.fn(),
          },
          balanceOperation: { create: jest.fn() },
          timeOffRequest: { update: jest.fn() },
        };
        return fn(txMock);
      });

      await expect(service.approve(mockManager, 'req-1')).rejects.toThrow(BadRequestException);
    });

    it('выбрасывает BadRequestException если заявка уже не PENDING', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue({
        ...mockPendingRequest,
        status: RequestStatus.APPROVED,
      });

      await expect(service.approve(mockManager, 'req-1')).rejects.toThrow();
    });

  });

  // ─── reject() ─────────────────────────────────────────────────────────────

  describe('reject()', () => {

    it('отклоняет pending-заявку и сохраняет комментарий', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue(mockPendingRequest);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          timeOffRequest: {
            update: jest.fn().mockResolvedValue({
              ...mockPendingRequest,
              status: RequestStatus.REJECTED,
              approverComment: 'Не подходящий период',
            }),
          },
        };
        return fn(txMock);
      });
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.reject(mockManager, 'req-1', 'Не подходящий период');

      expect(result.status).toBe(RequestStatus.REJECTED);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'leave-request.rejected',
        expect.objectContaining({ type: 'TIMEOFF_REJECTED', approverComment: 'Не подходящий период' }),
      );
    });

    it('отклоняет без комментария (approverComment = undefined)', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue(mockPendingRequest);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          timeOffRequest: {
            update: jest.fn().mockResolvedValue({ ...mockPendingRequest, status: RequestStatus.REJECTED }),
          },
        };
        return fn(txMock);
      });
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.reject(mockManager, 'req-1')).resolves.toBeDefined();
    });

    it('выбрасывает NotFoundException при несуществующей заявке', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue(null);

      await expect(service.reject(mockManager, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('выбрасывает ForbiddenException при попытке EMPLOYEE отклонить заявку', async () => {
      mockPrisma.timeOffRequest.findUnique.mockResolvedValue(mockPendingRequest);

      await expect(service.reject(mockEmployee, 'req-1')).rejects.toThrow(ForbiddenException);
    });

  });

  // ─── createBatch() ────────────────────────────────────────────────────────

  describe('createBatch()', () => {

    it('создаёт несколько заявок если баланса хватает', async () => {
      mockPrisma.timeBalance.findUnique.mockResolvedValue({ balanceHours: 24 });
      const createdRequests = [
        { id: 'r1', date: new Date('2026-07-01'), hours: 8 },
        { id: 'r2', date: new Date('2026-07-02'), hours: 8 },
      ];
      mockPrisma.$transaction.mockResolvedValue(createdRequests);

      const result = await service.createBatch(mockEmployee, {
        dates: ['2026-07-01', '2026-07-02'],
        hours: 8,
        reason: 'personal',
      });

      expect(result).toHaveLength(2);
    });

    it('выбрасывает BadRequestException если баланса не хватает', async () => {
      mockPrisma.timeBalance.findUnique.mockResolvedValue({ balanceHours: 4 });

      await expect(
        service.createBatch(mockEmployee, {
          dates: ['2026-07-01', '2026-07-02'],
          hours: 8,
          reason: 'personal',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('выбрасывает BadRequestException если баланс не найден', async () => {
      mockPrisma.timeBalance.findUnique.mockResolvedValue(null);

      await expect(
        service.createBatch(mockEmployee, { dates: ['2026-07-01'], hours: 8, reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });

  });

});
