import { mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { createLogger, format, transports } from 'winston';
import { WinstonLogger, utilities } from 'nest-winston';
import { appConfig } from './config.service';

type LoggerSettings = Pick<typeof appConfig, 'appEnv' | 'logDir' | 'logLevel'>;

export function createAppLogger(settings: LoggerSettings = appConfig) {
  const local = settings.appEnv === 'local';
  if (!local) mkdirSync(settings.logDir, { recursive: true });
  const instance = createLogger({
    level: settings.logLevel,
    format: format.combine(format.timestamp(), format.errors({ stack: true }), local
      ? utilities.format.nestLike('BFF', { colors: true, prettyPrint: true })
      : format.json()),
    transports: local ? [new transports.Console()] : [
      new transports.File({ filename: path.join(settings.logDir, 'application.log'), maxsize: 10 * 1024 * 1024, maxFiles: 5, tailable: true }),
      new transports.File({ filename: path.join(settings.logDir, 'error.log'), level: 'error', maxsize: 10 * 1024 * 1024, maxFiles: 5, tailable: true }),
    ],
  });
  return new WinstonLogger(instance);
}
