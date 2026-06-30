import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { TelegramAuthService } from './telegram-auth.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('crypto', () => {
  const actual = jest.requireActual('crypto');
  return {
    ...actual,
    randomBytes: jest.fn(),
  };
});

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

const MOCK_RAW_TOKEN = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
const MOCK_TOKEN_HASH = hashToken(MOCK_RAW_TOKEN);
const EXPIRED_DATE = new Date(Date.now() - 1000);
const FUTURE_DATE = new Date(Date.now() + 86400000);

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    timeBalance: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockJwt = {
    signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  };

  const mockTelegramAuth = {
    validateInitData: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'ENABLE_TELEGRAM_AUTH') return 'true';
      if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
      return undefined;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: TelegramAuthService, useValue: mockTelegramAuth },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    (randomBytes as jest.Mock).mockReturnValue(Buffer.from(MOCK_RAW_TOKEN, 'hex'));
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

    it('должен успешно аутентифицировать существующего пользователя и вернуть refresh token', async () => {
      mockTelegramAuth.validateInitData.mockReturnValue({ valid: true, user: validTelegramUser });
      mockPrisma.user.findFirst.mockResolvedValue(existingUser);

      const result = await service.telegramLogin('valid-init-data');

      expect(mockTelegramAuth.validateInitData).toHaveBeenCalledWith('valid-init-data');
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { telegramId: '12345' },
        include: { timeBalance: true, team: true, manager: true },
      });
      expect(mockJwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        role: 'EMPLOYEE',
        teamId: 'team-1',
      });
      // Проверить что refresh token создан с хешем
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tokenHash: MOCK_TOKEN_HASH,
          userId: 'user-1',
        }),
      });
      // В ответе — raw token, не hash
      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        refreshToken: MOCK_RAW_TOKEN,
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
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.telegramLogin('valid-init-data')).rejects.toThrow(UnauthorizedException);
      await expect(service.telegramLogin('valid-init-data')).rejects.toThrow('Пользователь не найден');
    });

    it('должен выбросить UnauthorizedException если пользователь заблокирован', async () => {
      mockTelegramAuth.validateInitData.mockReturnValue({ valid: true, user: validTelegramUser });
      mockPrisma.user.findFirst.mockResolvedValue({ ...existingUser, isActive: false });

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

  // ─── Refresh token lifecycle ──────────────────────────────────────────

  describe('refreshTokens()', () => {

    const mockStoredToken = {
      id: 'rt-1',
      tokenHash: MOCK_TOKEN_HASH,
      userId: 'user-1',
      expiresAt: FUTURE_DATE,
      user: {
        id: 'user-1',
        fullName: 'Test User',
        role: 'EMPLOYEE',
        teamId: 'team-1',
        isActive: true,
        timeBalance: {} as any,
        team: {} as any,
        manager: null,
      },
    };

    it('ротирует refresh token: старый удаляется, новый выдаётся', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      mockPrisma.refreshToken.delete.mockResolvedValue({});

      const result = await service.refreshTokens(MOCK_RAW_TOKEN);

      // Поиск по хешу
      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: MOCK_TOKEN_HASH },
        include: expect.any(Object),
      });
      // Старый токен удалён
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } });
      // Новый токен создан с новым хешем
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      // Вернулся новый raw token
      expect(result.refreshToken).toBe(MOCK_RAW_TOKEN);
    });

    it('выбрасывает UnauthorizedException для несуществующего токена', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashToken('invalid-token') },
        include: expect.any(Object),
      });
    });

    it('выбрасывает UnauthorizedException для истёкшего токена и удаляет его', async () => {
      const expiredToken = { ...mockStoredToken, expiresAt: EXPIRED_DATE };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(expiredToken);
      mockPrisma.refreshToken.delete.mockResolvedValue({});

      await expect(service.refreshTokens(MOCK_RAW_TOKEN)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } });
    });

    it('выбрасывает UnauthorizedException для заблокированного пользователя', async () => {
      const blockedUser = {
        ...mockStoredToken,
        user: { ...mockStoredToken.user, isActive: false },
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(blockedUser);
      mockPrisma.refreshToken.delete.mockResolvedValue({});

      await expect(service.refreshTokens(MOCK_RAW_TOKEN)).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-1' } });
    });

  });

  describe('logout()', () => {

    it('удаляет refresh token по хешу', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 } as any);

      await service.logout(MOCK_RAW_TOKEN);

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: MOCK_TOKEN_HASH },
      });
    });

    it('не выбрасывает ошибку при удалении несуществующего токена', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 } as any);

      await expect(service.logout('non-existent')).resolves.not.toThrow();
    });

  });

});
