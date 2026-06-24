import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthService } from './telegram-auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    timeBalance: {
      create: jest.fn(),
    },
  };

  const mockJwt = {
    signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  };

  const mockTelegramAuth = {
    validateInitData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: TelegramAuthService, useValue: mockTelegramAuth },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('telegramLogin', () => {
    const validTelegramUser = {
      id: 12345,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
    };

    const existingUser = {
      id: 'user-1',
      telegramId: '12345',
      fullName: 'Test User',
      role: 'EMPLOYEE' as const,
      teamId: 'team-1',
      username: 'testuser',
      isActive: true,
      timeBalance: { balanceHours: 40 },
      team: { id: 'team-1', name: 'QA Team' },
      manager: null,
    };

    it('должен успешно аутентифицировать существующего пользователя', async () => {
      mockTelegramAuth.validateInitData.mockReturnValue({ valid: true, user: validTelegramUser });
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.telegramLogin('valid-init-data');

      expect(mockTelegramAuth.validateInitData).toHaveBeenCalledWith('valid-init-data');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '12345' },
        include: { timeBalance: true, team: true, manager: true },
      });
      expect(mockJwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        role: 'EMPLOYEE',
        teamId: 'team-1',
      });
      expect(result).toEqual({
        token: 'mock-jwt-token',
        accessToken: 'mock-jwt-token',
        user: expect.objectContaining({
          id: 'user-1',
          fullName: 'Test User',
        }),
      });
    });

    it('должен выбросить UnauthorizedException при невалидном initData', async () => {
      mockTelegramAuth.validateInitData.mockReturnValue({ valid: false, reason: 'hash mismatch' });

      await expect(service.telegramLogin('invalid-data')).rejects.toThrow(UnauthorizedException);
    });

    it('должен выбросить UnauthorizedException если пользователь не найден', async () => {
      mockTelegramAuth.validateInitData.mockReturnValue({ valid: true, user: validTelegramUser });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.telegramLogin('valid-init-data')).rejects.toThrow(UnauthorizedException);
      await expect(service.telegramLogin('valid-init-data')).rejects.toThrow('Пользователь не найден');
    });

    it('должен выбросить UnauthorizedException если пользователь заблокирован', async () => {
      mockTelegramAuth.validateInitData.mockReturnValue({ valid: true, user: validTelegramUser });
      mockPrisma.user.findUnique.mockResolvedValue({ ...existingUser, isActive: false });

      await expect(service.telegramLogin('valid-init-data')).rejects.toThrow(UnauthorizedException);
      await expect(service.telegramLogin('valid-init-data')).rejects.toThrow('Доступ заблокирован');
    });
  });

  describe('getProfile', () => {
    it('должен вернуть профиль пользователя', async () => {
      const mockProfile = {
        id: 'user-1',
        fullName: 'Test User',
        team: { id: 'team-1', name: 'QA Team' },
        timeBalance: { balanceHours: 40 },
      };

      mockPrisma.user.findUniqueOrThrow.mockResolvedValue(mockProfile);

      const result = await service.getProfile('user-1');

      expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: { team: true, manager: true, timeBalance: true },
      });
      expect(result).toEqual(mockProfile);
    });
  });
});
