import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { AppLogger } from './logger.service';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { AllExceptionsFilter } from '../../common/exceptions/all-exceptions.filter';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const isProd = nodeEnv === 'production';

        return {
          pinoHttp: {
            autoLogging: false,
            quietReqLogger: true,
            level: isProd ? 'info' : 'trace',
            formatters: {
              level: (label: string) => ({ level: label }),
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers["set-cookie"]',
                'password',
                'passwordHash',
                '*.passwordHash',
                'accessToken',
                'refreshToken',
                '*.accessToken',
                '*.refreshToken',
                'clientSecret',
                '*.clientSecret',
                'JWT_SECRET',
                'DATABASE_URL',
              ],
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),
  ],
  providers: [
    AppLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [AppLogger, PinoLoggerModule],
})
export class LoggingModule {}