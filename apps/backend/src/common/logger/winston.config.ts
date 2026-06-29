import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { format, transports } from 'winston';

type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';

export interface WinstonConfigOptions {
  nodeEnv: 'development' | 'test' | 'production';
  logLevel: LogLevel;
  logDir?: string;
}

export function createWinstonTransports(options: WinstonConfigOptions) {
  const baseTransports: Array<InstanceType<typeof transports.Console> | InstanceType<typeof transports.File>> = [
    new transports.Console({
      level: options.logLevel,
      format:
        options.nodeEnv === 'production'
          ? format.combine(format.timestamp(), format.errors({ stack: true }), format.json())
          : format.combine(
              format.timestamp(),
              format.ms(),
              nestWinstonModuleUtilities.format.nestLike('QA-TimeOff', {
                prettyPrint: true,
              }),
            ),
    }),
  ];

  if (options.nodeEnv === 'production') {
    const directory = options.logDir ?? 'logs';

    baseTransports.push(
      new DailyRotateFile({
        filename: `${directory}/error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '90d',
        maxSize: '20m',
        format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
      }) as any,
    );

    baseTransports.push(
      new DailyRotateFile({
        filename: `${directory}/combined-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        level: options.logLevel,
        maxFiles: '30d',
        maxSize: '50m',
        format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
      }) as any,
    );
  }

  return baseTransports;
}

