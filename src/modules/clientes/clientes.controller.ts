import * as crypto from 'node:crypto';
import {
  BadGatewayException,
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/jwt-payload';
import {
  CORE_BANKING_PORT,
  type CoreBankingPort,
  type TipoDocumento,
} from '../solicitudes/domain/ports/core-banking.port';
import { isErr } from '../../shared/kernel/result';
import {
  CoreBankingNotFoundError,
  type DomainError,
} from '../../shared/kernel/domain-error';
import { getCorrelationId } from '../../shared/http/correlation-id.context';
import { AuditoriaService } from '../auditoria/auditoria.service';

const CACHE_TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@ApiTags('Clientes')
@ApiBearerAuth('access-token')
@Controller('clientes')
export class ClientesController {
  private readonly logger = new Logger(ClientesController.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(
    @Inject(CORE_BANKING_PORT) private readonly core: CoreBankingPort,
    private readonly audit: AuditoriaService,
  ) {}

  @Get(':tipoDoc/:numDoc')
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @ApiOperation({ summary: 'Consultar datos del cliente desde el Core' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Cliente no existe en el Core' })
  async getCliente(
    @Param('tipoDoc') tipoDoc: TipoDocumento,
    @Param('numDoc') numDoc: string,
  ) {
    const correlationId = getCorrelationId();
    const result = await this.core.consultarCliente(tipoDoc, numDoc, correlationId);
    if (isErr(result)) throw this.toHttp(result.error);
    return result.value;
  }

  /**
   * HU-001: Productos elegibles para un cliente. Cachea por 60s; emite evento
   * de auditoría con hash del documento (no PII en claro).
   */
  @Get(':tipoDoc/:numDoc/productos-elegibles')
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @ApiOperation({
    summary: 'Productos elegibles para el cliente (HU-001, cache 60s)',
    description:
      'Consulta el Core con reglas de KYC. Devuelve la lista filtrada y registra ' +
      'evento de auditoría con hash SHA-256 del documento.',
  })
  async getProductosElegibles(
    @Param('tipoDoc') tipoDoc: TipoDocumento,
    @Param('numDoc') numDoc: string,
    @CurrentUser() user: AuthUser,
  ) {
    const correlationId = getCorrelationId();
    const cacheKey = `elegibles:${tipoDoc}:${numDoc}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.debug(`cache HIT for ${cacheKey}`);
      this.recordAudit(user, tipoDoc, numDoc, correlationId, 'cache-hit');
      return { ...(cached.value as object), cache: 'HIT' };
    }

    const result = await this.core.consultarProductosElegibles(tipoDoc, numDoc, correlationId);
    if (isErr(result)) throw this.toHttp(result.error);

    const payload = { clienteNumDoc: numDoc, productos: result.value };
    this.cache.set(cacheKey, { value: payload, expiresAt: Date.now() + CACHE_TTL_MS });

    this.recordAudit(user, tipoDoc, numDoc, correlationId, 'cache-miss');
    return { ...payload, cache: 'MISS' };
  }

  private recordAudit(
    user: AuthUser,
    tipoDoc: TipoDocumento,
    numDoc: string,
    correlationId: string,
    cacheStatus: 'cache-hit' | 'cache-miss',
  ): void {
    const docHash = crypto.createHash('sha256').update(`${tipoDoc}:${numDoc}`).digest('hex');
    void this.audit.record({
      actor: user.id,
      accion: `consultar.productos-elegibles.${cacheStatus}`,
      recursoTipo: 'cliente',
      recursoId: docHash, // hash, no PII en claro
      correlationId,
    });
  }

  private toHttp(error: DomainError): Error {
    if (error instanceof CoreBankingNotFoundError) {
      return new NotFoundException(error.message);
    }
    return new BadGatewayException(error.message);
  }
}
