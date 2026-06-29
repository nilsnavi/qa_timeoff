import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RequestStatus, Role, VacationType } from '@prisma/client';
import { VacationService } from './vacation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { EmailNotificationService } from '../notifications/email-notification.service';

describe('VacationService', () => {
  let service: VacationService;

  const mockManager = {
    id: 'manager-1',
    fullName: 'Менеджер',
    role: Role.MANAGER,
    teamId: 'team-1',
  } as any;

  const mockEmployee = {
    id: 'employee-1',
    role: Role.EMPLOYEE,
    teamId: 'team-1',
  } as any;

  const mockPendingVacation = {
    id: 'vac-1',
    userId: 'employee-1',
    startDate: new Date('2026-08-01'),
    endDate:   new Date('2026-08-14'),
    daysCount: 14,
    vacationType: VacationType.ANNUAL,
    status: RequestStatus.PENDING,
    user: { id: 'employee-1', fullName: 'Сотрудник', role: Role.EMPLOYEE, teamId: 'team-1' },
  };

  const mockPrisma = {
    vacationRequest: {
      findUnique: jest.fn(),
      findMany:   jest.fn(),
      update:     jest.fn(),
    },
    notification: { create: jest.fn() },
    user:         { findMany: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };

  const mockEventBus = { emit: jest.fn() };
  const mockEmailSvc = { sendRequestApproved: jest.fn(), sendRequestRejected: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VacationService,
        { provide: PrismaService,            useValue: mockPrisma   },
        { provide: EventBusService,          useValue: mockEventBus },
        { provide: EmailNotificationService, useValue: mockEmailSvc },
      ],
    }).compile();

    service = module.get<VacationService>(VacationService);
    jest.clearAllMocks();
  });

  // ─── approve() ────────────────────────────────────────────────────────────

  describe('approve()', () => {

    it('одобряет pending-заявку на отпуск', async () => {
      mockPrisma.vacationRequest.findUnique.mockResolvedValue(mockPendingVacation);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          vacationRequest: {
            update: jest.fn().mockResolvedValue({
              ...mockPendingVacation,
              status: RequestStatus.APPROVED,
              approverId: mockManager.id,
            }),
          },
        };
        return fn(txMock);
      });
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.approve(mockManager, 'vac-1');

      expect(result.status).toBe(RequestStatus.APPROVED);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'leave-request.approved',
        expect.objectContaining({ type: 'VACATION_APPROVED' }),
      );
    });

    it('выбрасывает NotFoundException для несуществующей заявки', async () => {
      mockPrisma.vacationRequest.findUnique.mockResolvedValue(null);

      await expect(service.approve(mockManager, 'bad-id')).rejects.toThrow(NotFoundException);
    });

    it('выбрасывает ForbiddenException если EMPLOYEE пытается одобрить', async () => {
      mockPrisma.vacationRequest.findUnique.mockResolvedValue(mockPendingVacation);

      await expect(service.approve(mockEmployee, 'vac-1')).rejects.toThrow(ForbiddenException);
    });

  });

  // ─── reject() ─────────────────────────────────────────────────────────────

  describe('reject()', () => {

    it('отклоняет pending-заявку с комментарием', async () => {
      mockPrisma.vacationRequest.findUnique.mockResolvedValue(mockPendingVacation);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const txMock = {
          vacationRequest: {
            update: jest.fn().mockResolvedValue({
              ...mockPendingVacation,
              status: RequestStatus.REJECTED,
              approverComment: 'Загруженный период',
            }),
          },
        };
        return fn(txMock);
      });
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.reject(mockManager, 'vac-1', 'Загруженный период');

      expect(result.status).toBe(RequestStatus.REJECTED);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'leave-request.rejected',
        expect.objectContaining({ type: 'VACATION_REJECTED' }),
      );
    });

    it('выбрасывает NotFoundException для несуществующей заявки', async () => {
      mockPrisma.vacationRequest.findUnique.mockResolvedValue(null);

      await expect(service.reject(mockManager, 'missing')).rejects.toThrow(NotFoundException);
    });

  });

});
