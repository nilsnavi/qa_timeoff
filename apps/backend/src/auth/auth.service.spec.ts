import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthService } from './telegram-auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let telegramAuth: TelegramAuthService;

  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      upsert: jest.fn(),
    },
    timeBalance: {
      create: jest.fn(),
    },
  };

  const mockJwt = {
    signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'ADMIN_TELEGRAM_ID') return undefined;
      return null;
    }),
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
        { provide: ConfigService, useValue: mockConfig },
        { provide: TelegramAuthService, useValue: mockTelegramAuth },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    telegramAuth = module.get<TelegramAuthService>(TelegramAuthService);

    jest.clearAllMocks();
  });

  describe('telegramLogin', () => {
    const validTelegramUser = {
      id: 12345,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
    };

    it('должен успешно аутентифицировать с валидным initData', async () => {
      mockTelegramAuth.validateInitData.mockReturnValue({ valid: true, user: validTelegramUser });
      mockPrisma.user.findFirst.mockResolvedValue(null); // no existing users
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'user-1',
        telegramId: '12345',
        fullName: 'Test User',
        role: 'ADMIN', // first user becomes admin
        username: 'testuser',
        timeBalance: { balanceHours: 0 },
      });

      const result = await service.telegramLogin('valid-init-data');

      expect(telegramAuth.validateInitData).toHaveBeenCalledWith('valid-init-data');
      expect(mockJwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        role: 'ADMIN',
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

    it('должен создать пользователя если его нет в БД', async () => {
      mockTelegramAuth.validateInitData.mockReturnValue({ valid: true, user: validTelegramUser });
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'new-user',
        telegramId: '12345',
        fullName: 'Test User',
        role: 'EMPLOYEE',
        timeBalance: { balanceHours: 0 },
      });

      await service.telegramLogin('valid-init-data');

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            telegramId: '12345',
            fullName: 'Test User',
            username: 'testuser',
          }),
        }),
      );
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
