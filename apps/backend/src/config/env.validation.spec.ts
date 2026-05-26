import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    NODE_ENV: 'development',
    API_PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
    JWT_SECRET: '12345678901234567890123456789012',
    TELEGRAM_BOT_TOKEN: 'token',
  };

  it('должен валидировать корректный env', () => {
    const result = validateEnv(base);

    expect(result.API_PORT).toBe(3000);
    expect(result.RATE_LIMIT_TTL).toBe(60);
    expect(result.RATE_LIMIT_MAX).toBe(100);
    expect(result.LOG_LEVEL).toBe('info');
  });

  it('должен выбросить ошибку при некорректном API_PORT', () => {
    expect(() =>
      validateEnv({
        ...base,
        API_PORT: '70000',
      }),
    ).toThrow('API_PORT must be an integer between 1 and 65535');
  });

  it('должен выбросить ошибку при пустом JWT_SECRET', () => {
    expect(() =>
      validateEnv({
        ...base,
        JWT_SECRET: '',
      }),
    ).toThrow('Missing required environment variable: JWT_SECRET');
  });
});

