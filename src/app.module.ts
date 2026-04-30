import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { AppLoggerModule } from './shared/observability/logger.module';
import { MetricsModule } from './shared/observability/metrics.module';
import { CorrelationIdMiddleware } from './shared/http/correlation-id.middleware';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProductosModule } from './modules/productos/productos.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { SolicitudesModule } from './modules/solicitudes/solicitudes.module';
import type { Env } from './config/env.schema';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    MetricsModule,

    // MongoDB connection (Atlas) — async to read MONGODB_URI from validated env.
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        dbName: config.get('MONGODB_DB_NAME', { infer: true }),
        serverSelectionTimeoutMS: 10_000,
        retryWrites: true,
      }),
    }),

    // Rate limiting (default: 60 req/min per IP). Tightened on /auth/login later.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    AuthModule,
    HealthModule,
    AuditoriaModule,
    ProductosModule,
    ClientesModule,
    SolicitudesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
