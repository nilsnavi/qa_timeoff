import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NextFunction, Request, Response } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { createWinstonTransports } from './common/logger/winston.config';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const bootstrapConfig = new ConfigService();
  const logger = WinstonModule.createLogger({
    transports: createWinstonTransports({
      nodeEnv: (bootstrapConfig.get<string>('NODE_ENV') as 'development' | 'test' | 'production') ?? 'development',
      logLevel:
        (bootstrapConfig.get<string>('LOG_LEVEL') as 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly') ??
        'info',
      logDir: bootstrapConfig.get<string>('LOG_DIR'),
    }),
  });

  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger });
  const config = app.get(ConfigService);

  const frontendUrl = config.get<string>('FRONTEND_URL') ?? '';
  const apiUrl = `http://localhost:${config.get<number>('API_PORT') ?? 3000}`;
  const connectSrcUrls = ["'self'", apiUrl, frontendUrl].filter(Boolean);

  app.use(
    helmet({
      // Шаг 1: Report-Only — логируем нарушения, не блокируем.
      // Когда убедимся что всё работает — заменить на contentSecurityPolicy: { directives: {...} }
      contentSecurityPolicy: {
        reportOnly: true,
        directives: {
          defaultSrc:     ["'self'"],
          scriptSrc:      ["'self'"],
          styleSrc:       ["'self'", "'unsafe-inline'"],
          imgSrc:         ["'self'", 'data:', 'blob:'],
          fontSrc:        ["'self'", 'data:'],
          connectSrc:     connectSrcUrls,
          frameSrc:       ["'none'"],
          objectSrc:      ["'none'"],
          baseUri:        ["'self'"],
          formAction:     ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  const allowedOriginsRaw =
    config.get<string>('ALLOWED_ORIGINS') ?? config.get<string>('CORS_ORIGIN') ?? config.get<string>('FRONTEND_URL');

  const allowedOrigins = (allowedOriginsRaw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
  });

  app.use((req: Request, res: Response, next: NextFunction) => new RequestIdMiddleware().use(req, res, next));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const nodeEnv = config.get<string>('NODE_ENV');
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('QA TimeOff API')
      .setDescription('API for time off and vacation management')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(config.getOrThrow<number>('API_PORT'), '0.0.0.0');
}

bootstrap();
