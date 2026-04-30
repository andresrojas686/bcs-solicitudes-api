import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AUDITORIA_COLLECTION, AuditoriaSchema } from './auditoria.schema';
import { AuditoriaService } from './auditoria.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: AUDITORIA_COLLECTION, schema: AuditoriaSchema }])],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
