import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Solicitud } from '../../domain/entities/solicitud.entity';
import { EstadoSolicitud } from '../../domain/value-objects/estado-solicitud.vo';
import type {
  ListarSolicitudesQuery,
  ListarSolicitudesResult,
  SolicitudRepositoryPort,
} from '../../domain/ports/solicitud.repository.port';
import type { TipoDocumento } from '../../domain/ports/core-banking.port';
import { type SolicitudDocument, SOLICITUD_COLLECTION } from './solicitud.schema';

@Injectable()
export class SolicitudMongoRepository implements SolicitudRepositoryPort {
  constructor(
    @InjectModel(SOLICITUD_COLLECTION) private readonly model: Model<SolicitudDocument>,
  ) {}

  async guardar(solicitud: Solicitud): Promise<void> {
    const props = solicitud.toPersistence();
    await this.model
      .updateOne(
        { _id: props.id },
        {
          $set: {
            cliente: props.cliente,
            productoCodigo: props.productoCodigo,
            estado: props.estado.value,
            datosFormulario: props.datosFormulario,
            historicoEstados: props.historicoEstados,
            correlationId: props.correlationId,
            idempotencyKey: props.idempotencyKey,
            numeroProducto: props.numeroProducto,
            motivoRechazo: props.motivoRechazo,
            pendienteEnvioCore: props.pendienteEnvioCore,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
            version: props.version,
          },
        },
        { upsert: true },
      )
      .exec();
  }

  async buscarPorId(id: string): Promise<Solicitud | null> {
    const doc = await this.model.findById(id).lean<SolicitudDocument | null>().exec();
    return doc ? this.toEntity(doc) : null;
  }

  async buscarPorIdempotencyKey(key: string): Promise<Solicitud | null> {
    const doc = await this.model.findOne({ idempotencyKey: key }).lean<SolicitudDocument | null>().exec();
    return doc ? this.toEntity(doc) : null;
  }

  async listar(query: ListarSolicitudesQuery): Promise<ListarSolicitudesResult> {
    const filter: Record<string, unknown> = {};
    if (query.estado) filter.estado = query.estado;
    if (query.clienteNumDoc) filter['cliente.numDoc'] = query.clienteNumDoc;

    const skip = (query.page - 1) * query.size;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.size)
        .lean<SolicitudDocument[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((d) => this.toEntity(d)),
      total,
      page: query.page,
      size: query.size,
    };
  }

  private toEntity(doc: SolicitudDocument): Solicitud {
    return Solicitud.fromPersistence({
      id: doc._id,
      cliente: { tipoDoc: doc.cliente.tipoDoc as TipoDocumento, numDoc: doc.cliente.numDoc },
      productoCodigo: doc.productoCodigo,
      estado: EstadoSolicitud.from(doc.estado),
      datosFormulario: doc.datosFormulario ?? {},
      historicoEstados: doc.historicoEstados ?? [],
      correlationId: doc.correlationId,
      idempotencyKey: doc.idempotencyKey,
      numeroProducto: doc.numeroProducto,
      motivoRechazo: doc.motivoRechazo,
      pendienteEnvioCore: doc.pendienteEnvioCore ?? false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      version: doc.version ?? 0,
    });
  }
}
