/**
 * TEMPORARY Twilio testing entrypoint only.
 * Does not replace src/main.ts. Use with:
 *   npx nest start -p tsconfig.twilio-test.json --entryFile main.twilio-test --tsc
 */
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  // Use Nest's default logger so RoutesResolver "Mapped {...}" lines are visible.
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  app.enableShutdownHooks();
  app.use(helmet());
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

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);

  Logger.log(
    `Twilio test server listening on http://localhost:${port}`,
    'TwilioTestBootstrap',
  );
}

bootstrap();
