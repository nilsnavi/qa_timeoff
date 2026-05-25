type NodeEnv = 'development' | 'test' | 'production';

interface ValidatedEnv {
  NODE_ENV: NodeEnv;
  API_PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  FRONTEND_URL?: string;
  CORS_ORIGIN?: string;
}

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

function parsePort(value: unknown) {
  const port = Number(value ?? 3000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535');
  }

  return port;
}

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const NODE_ENV = parseNodeEnv(config.NODE_ENV);
  const API_PORT = parsePort(config.API_PORT);
  const DATABASE_URL = requiredString(config, 'DATABASE_URL');
  const JWT_SECRET = requiredString(config, 'JWT_SECRET');
  const TELEGRAM_BOT_TOKEN = requiredString(config, 'TELEGRAM_BOT_TOKEN');
  const FRONTEND_URL = optionalString(config, 'FRONTEND_URL');
  const CORS_ORIGIN = optionalString(config, 'CORS_ORIGIN');

  if (NODE_ENV === 'production' && JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  return {
    NODE_ENV,
    API_PORT,
    DATABASE_URL,
    JWT_SECRET,
    TELEGRAM_BOT_TOKEN,
    FRONTEND_URL,
    CORS_ORIGIN,
  };
}
