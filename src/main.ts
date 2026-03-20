import { ValidationPipe, VersioningType } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './@core/filters/exception/all-exceptions.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  const { httpAdapter } = app.get(HttpAdapterHost);

  // Helmet Security
  app.use(helmet());

  // Custom Headers
  app.use((req, res, next) => {
    res.header('Cross-Origin-Resource-Policy', 'cross-origin'); // Change to 'same-site' if appropriate
    next();
  });

  // CORS
  app.enableCors({
    origin: '*',
  });

  // Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true, // allow conversion underneath
      },
    }),
  );

  // Uri Versioning
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Global Prefix
  app.setGlobalPrefix('api');

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  await app.listen(process.env['PORT'] as any as number);
}
bootstrap();
