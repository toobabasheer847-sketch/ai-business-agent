import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppLogger } from './infrastructure/logging/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(AppLogger));

  app.enableShutdownHooks();

  app.use(helmet());

  const configService = app.get(ConfigService);
  const corsOrigins =
    configService.get<string[]>('CORS_ORIGINS') ?? ['http://localhost:5173'];

  // JWT is sent via Authorization Bearer (localStorage), not cookies.
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
  });

  // Global API prefix
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(configService.get<string>('PORT') ?? process.env.PORT ?? 3000);
}

bootstrap();
