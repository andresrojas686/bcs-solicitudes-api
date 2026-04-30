import { Module } from '@nestjs/common';
import { CoreBankingModule } from '../solicitudes/infrastructure/core-banking/core-banking.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ClientesController } from './clientes.controller';

@Module({
  imports: [CoreBankingModule, AuditoriaModule],
  controllers: [ClientesController],
})
export class ClientesModule {}
