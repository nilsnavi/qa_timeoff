import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
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
      new transports.File({
        filename: `${directory}/error.log`,
        level: 'error',
        format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
      }),
    );

    baseTransports.push(
      new transports.File({
        filename: `${directory}/combined.log`,
        level: options.logLevel,
        format: format.combine(format.timestamp(), format.errors({ stack: true }), format.json()),
      }),
    );
  }

  return baseTransports;
}

