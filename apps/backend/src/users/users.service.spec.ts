import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailNotificationService } from '../notifications/email-notification.service';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findFirst:  jest.fn(),
      create:     jest.fn(),
      update:     jest.fn(),
      findMany:   jest.fn(),
    },
  };

  const mockEmailSvc = { sendTempPassword: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService,            useValue: mockPrisma   },
        { provide: EmailNotificationService, useValue: mockEmailSvc },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();

    (bcrypt.hash    as jest.Mock).mockResolvedValue('hashed-password');
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
  });

  // ─── create() ─────────────────────────────────────────────────────────────

  describe('create()', () => {

    it('создаёт пользователя с временным паролем и флагом mustChangePassword', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user',
        fullName: 'Новый Пользователь',
        email: 'new@test.ru',
        mustChangePassword: true,
        role: 'EMPLOYEE',
        timeBalance: {},
      });

      const result = await service.create({
        fullName: 'Новый Пользователь',
        email: 'new@test.ru',
        role: 'EMPLOYEE',
      } as any);

      expect(result.user.mustChangePassword).toBe(true);
      expect(result.tempPassword).toBeDefined();
      expect(result.tempPassword.length).toBeGreaterThan(0);
      expect(bcrypt.hash).toHaveBeenCalled();
    });

    it('выбрасывает ConflictException если email уже занят', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'busy@test.ru' });

      await expect(
        service.create({ fullName: 'Другой', email: 'busy@test.ru', role: 'EMPLOYEE' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('выбрасывает BadRequestException если email не передан', async () => {
      await expect(
        service.create({ fullName: 'Без почты', role: 'EMPLOYEE' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('отправляет письмо с временным паролем на email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1', fullName: 'Иван', email: 'ivan@test.ru',
        mustChangePassword: true, role: 'EMPLOYEE', timeBalance: {},
      });

      await service.create({ fullName: 'Иван', email: 'ivan@test.ru', role: 'EMPLOYEE' } as any);

      // Email отправляется асинхронно через .catch — проверяем через небольшой таймаут
      await new Promise(r => setTimeout(r, 10));
      expect(mockEmailSvc.sendTempPassword).toHaveBeenCalledWith(
        'ivan@test.ru', 'Иван', expect.any(String), false,
      );
    });

  });

  // ─── resetPassword() ──────────────────────────────────────────────────────

  describe('resetPassword()', () => {

    it('генерирует новый пароль и устанавливает mustChangePassword = true', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', fullName: 'Сотрудник', email: 'emp@test.ru', isActive: true,
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.resetPassword('u1');

      expect(result.tempPassword).toBeDefined();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mustChangePassword: true }),
        }),
      );
    });

    it('выбрасывает NotFoundException если пользователь не найден', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('ghost')).rejects.toThrow(NotFoundException);
    });

    it('выбрасывает BadRequestException если пользователь заблокирован', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1', email: 'x@t.ru', isActive: false, fullName: 'Бывший',
      });

      await expect(service.resetPassword('u1')).rejects.toThrow(BadRequestException);
    });

  });

  // ─── changePassword() ─────────────────────────────────────────────────────

  describe('changePassword()', () => {

    it('успешно меняет пароль и снимает флаг mustChangePassword', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: 'old-hash' });
      mockPrisma.user.update.mockResolvedValue({});
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword('u1', { currentPassword: 'OldPass1!', newPassword: 'NewPass2!' }),
      ).resolves.toEqual({ success: true });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mustChangePassword: false }),
        }),
      );
    });

    it('выбрасывает UnauthorizedException при неверном текущем пароле', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword('u1', { currentPassword: 'wrong', newPassword: 'NewPass2!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('выбрасывает BadRequestException если новый пароль совпадает со старым', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ passwordHash: 'hash' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.changePassword('u1', { currentPassword: 'Same1!', newPassword: 'Same1!' }),
      ).rejects.toThrow(BadRequestException);
    });

  });

});
