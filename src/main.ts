// OpenTelemetry MUST be imported first to instrument all subsequent imports.
import './shared/observability/otel';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger, PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/http/all-exceptions.filter';
import type { Env } from './config/env.schema';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);
  const logger = app.get(Logger);
  app.useLogger(logger);

  // --- Security middleware ---
  app.use(helmet({ contentSecurityPolicy: false })); // CSP off; SPA delivers its own
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });

  // --- Validation: strict whitelist (drops unknown fields, fails on extras) ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // --- RFC 7807 problem+json filter on every error ---
  const isDev = config.get('NODE_ENV', { infer: true }) === 'development';
  const pinoForFilter = await app.resolve(PinoLogger);
  app.useGlobalFilters(new AllExceptionsFilter(pinoForFilter, isDev));

  // --- Swagger / OpenAPI at /api/docs ---
  const openApiConfig = new DocumentBuilder()
    .setTitle('BCS — Solicitudes Digitales API')
    .setDescription(
      'Backend de la plataforma de solicitudes digitales de productos bancarios. ' +
        'Prueba Técnica BCS — Líder Técnico.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Health', 'Liveness y readiness probes')
    .addTag('Auth', 'Autenticación (JWT mock)')
    .addTag('Productos', 'Catálogo de productos')
    .addTag('Clientes', 'Consulta de clientes y productos elegibles')
    .addTag('Solicitudes', 'CRUD y máquina de estados de solicitudes')
    .build();

  const document = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // --- Listen ---
  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  logger.log(`🚀 bcs-solicitudes-api listening on http://localhost:${port}`);
  logger.log(`📘 Swagger UI:        http://localhost:${port}/api/docs`);
  logger.log(`💚 Health (liveness):  http://localhost:${port}/health`);
  logger.log(`💚 Health (readiness): http://localhost:${port}/health/ready`);
}

bootstrap();
