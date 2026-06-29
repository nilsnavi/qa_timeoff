type NodeEnv = 'development' | 'test' | 'production';

interface ValidatedEnv {
  NODE_ENV: NodeEnv;
  API_PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRATION?: string;
  JWT_REFRESH_EXPIRATION?: string;
  AUTH_MODE: 'web' | 'telegram' | 'both';
  ENABLE_TELEGRAM_AUTH: boolean;
  TELEGRAM_BOT_TOKEN?: string;
  FRONTEND_URL?: string;
  CORS_ORIGIN?: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_MAX: number;
  LOG_LEVEL: LogLevel;
  LOG_DIR?: string;
  CACHE_TTL: number;
  REDIS_URL?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  EMAIL_FROM?: string;
  ADMIN_TELEGRAM_ID?: string;
}

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

const nodeEnvs: NodeEnv[] = ['development', 'test', 'production'];

function requiredString(config: Record<string, unknown>, key: string) {
  const value = config[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim();
}

function optionalString(config: Record<string, unknown>, key: string) {
  const value = config[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }

  return value.trim();
}

function parseNodeEnv(value: unknown): NodeEnv {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'development';
  }

  if (!nodeEnvs.includes(value as NodeEnv)) {
    throw new Error(`NODE_ENV must be one of: ${nodeEnvs.join(', ')}`);
  }

  return value as NodeEnv;
}

function parseAuthMode(value: unknown): 'web' | 'telegram' | 'both' {
  const allowed: Array<'web' | 'telegram' | 'both'> = ['web', 'telegram', 'both'];
  if (typeof value !== 'string' || !allowed.includes(value as 'web' | 'telegram' | 'both')) {
    return 'web';
  }
  return value as 'web' | 'telegram' | 'both';
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return fallback;
}

function parsePort(value: unknown) {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parsePositiveInt(value: unknown, key: string, fallback: number) {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return parsed;
}

function parseLogLevel(value: unknown): LogLevel {
  const allowed: LogLevel[] = ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'];

  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'info';
  }

  const normalized = value.trim().toLowerCase() as LogLevel;

  if (!allowed.includes(normalized)) {
    throw new Error(`LOG_LEVEL must be one of: ${allowed.join(', ')}`);
  }

  return normalized;
}

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const NODE_ENV = parseNodeEnv(config.NODE_ENV);
  const API_PORT = parsePort(config.API_PORT);
  const DATABASE_URL = requiredString(config, 'DATABASE_URL');
  const JWT_SECRET = requiredString(config, 'JWT_SECRET');
  const JWT_EXPIRATION = optionalString(config, 'JWT_EXPIRATION');
  const JWT_REFRESH_EXPIRATION = optionalString(config, 'JWT_REFRESH_EXPIRATION');
  const AUTH_MODE = parseAuthMode(config.AUTH_MODE);
  const ENABLE_TELEGRAM_AUTH = parseBoolean(config.ENABLE_TELEGRAM_AUTH, false);
  const TELEGRAM_BOT_TOKEN = optionalString(config, 'TELEGRAM_BOT_TOKEN');
  const FRONTEND_URL = optionalString(config, 'FRONTEND_URL');
  const CORS_ORIGIN = optionalString(config, 'CORS_ORIGIN');
  const ALLOWED_ORIGINS = optionalString(config, 'ALLOWED_ORIGINS');
  const RATE_LIMIT_TTL = parsePositiveInt(config.RATE_LIMIT_TTL, 'RATE_LIMIT_TTL', 60);
  const RATE_LIMIT_MAX = parsePositiveInt(config.RATE_LIMIT_MAX, 'RATE_LIMIT_MAX', 100);
  const LOG_LEVEL = parseLogLevel(config.LOG_LEVEL);
  const LOG_DIR = optionalString(config, 'LOG_DIR');
  const CACHE_TTL = parsePositiveInt(config.CACHE_TTL, 'CACHE_TTL', 300);
  const REDIS_URL = optionalString(config, 'REDIS_URL');
  const SMTP_HOST    = optionalString(config, 'SMTP_HOST');
  const SMTP_USER    = optionalString(config, 'SMTP_USER');
  const SMTP_PASS    = optionalString(config, 'SMTP_PASS');
  const EMAIL_FROM   = optionalString(config, 'EMAIL_FROM');
  const SMTP_PORT    = config['SMTP_PORT'] ? Number(config['SMTP_PORT']) : undefined;
  const SMTP_SECURE  = config['SMTP_SECURE'] === 'true' || config['SMTP_SECURE'] === true;
  const ADMIN_TELEGRAM_ID = optionalString(config, 'ADMIN_TELEGRAM_ID');

  if (NODE_ENV === 'production' && JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  if (ENABLE_TELEGRAM_AUTH && !TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required when ENABLE_TELEGRAM_AUTH=true');
  }

  // В продакшне SMTP обязателен — без него временные пароли не доходят
  if (NODE_ENV === 'production') {
    const smtpMissing: string[] = [];
    if (!SMTP_HOST)  smtpMissing.push('SMTP_HOST');
    if (!SMTP_USER)  smtpMissing.push('SMTP_USER');
    if (!SMTP_PASS)  smtpMissing.push('SMTP_PASS');
    if (!EMAIL_FROM) smtpMissing.push('EMAIL_FROM');
    if (smtpMissing.length > 0) {
      throw new Error(
        `Missing required SMTP configuration in production: ${smtpMissing.join(', ')}. ` +
        'Email notifications are required for user management (temp passwords, approvals).'
      );
    }
  }

  return {
    NODE_ENV,
    API_PORT,
    DATABASE_URL,
    JWT_SECRET,
    JWT_EXPIRATION,
    JWT_REFRESH_EXPIRATION,
    AUTH_MODE,
    ENABLE_TELEGRAM_AUTH,
    TELEGRAM_BOT_TOKEN,
    FRONTEND_URL,
    CORS_ORIGIN,
    ALLOWED_ORIGINS,
    RATE_LIMIT_TTL,
    RATE_LIMIT_MAX,
    LOG_LEVEL,
    LOG_DIR,
    CACHE_TTL,
    REDIS_URL,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    EMAIL_FROM,
    ADMIN_TELEGRAM_ID,
  };
}
