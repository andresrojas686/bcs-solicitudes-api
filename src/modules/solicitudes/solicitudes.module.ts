import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SOLICITUD_REPOSITORY } from './domain/ports/solicitud.repository.port';
import { SolicitudMongoRepository } from './infrastructure/persistence/solicitud.mongo.repository';
import { SOLICITUD_COLLECTION, SolicitudSchema } from './infrastructure/persistence/solicitud.schema';
import { CoreBankingModule } from './infrastructure/core-banking/core-banking.module';
import { CrearSolicitudUseCase } from './application/use-cases/crear-solicitud.usecase';
import { ConsultarSolicitudUseCase } from './application/use-cases/consultar-solicitud.usecase';
import { ListarSolicitudesUseCase } from './application/use-cases/listar-solicitudes.usecase';
import { ActualizarSolicitudUseCase } from './application/use-cases/actualizar-solicitud.usecase';
import { TransicionarSolicitudUseCase } from './application/use-cases/transicionar-solicitud.usecase';
import { FinalizarSolicitudUseCase } from './application/use-cases/finalizar-solicitud.usecase';
import { SolicitudesController } from './interfaces/http/solicitudes.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SOLICITUD_COLLECTION, schema: SolicitudSchema }]),
    CoreBankingModule,
  ],
  controllers: [SolicitudesController],
  providers: [
    { provide: SOLICITUD_REPOSITORY, useClass: SolicitudMongoRepository },
    CrearSolicitudUseCase,
    ConsultarSolicitudUseCase,
    ListarSolicitudesUseCase,
    ActualizarSolicitudUseCase,
    TransicionarSolicitudUseCase,
    FinalizarSolicitudUseCase,
  ],
})
export class SolicitudesModule {}
