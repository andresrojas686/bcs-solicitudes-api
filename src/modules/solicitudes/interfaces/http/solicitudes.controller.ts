import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { isErr } from '../../../../shared/kernel/result';
import {
  type DomainError,
  IdempotencyKeyConflictError,
  SolicitudNotFoundError,
} from '../../../../shared/kernel/domain-error';
import { InvalidStateTransitionError } from '../../domain/value-objects/estado-solicitud.vo';
import { CrearSolicitudUseCase } from '../../application/use-cases/crear-solicitud.usecase';
import { ConsultarSolicitudUseCase } from '../../application/use-cases/consultar-solicitud.usecase';
import { ListarSolicitudesUseCase } from '../../application/use-cases/listar-solicitudes.usecase';
import { ActualizarSolicitudUseCase } from '../../application/use-cases/actualizar-solicitud.usecase';
import { TransicionarSolicitudUseCase } from '../../application/use-cases/transicionar-solicitud.usecase';
import { FinalizarSolicitudUseCase } from '../../application/use-cases/finalizar-solicitud.usecase';
import { getCorrelationId } from '../../../../shared/http/correlation-id.context';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { Roles } from '../../../auth/decorators/roles.decorator';
import type { AuthUser } from '../../../auth/jwt-payload';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudDto } from './dto/update-solicitud.dto';
import { TransitionSolicitudDto } from './dto/transition-solicitud.dto';
import { ListSolicitudesQueryDto } from './dto/list-solicitudes-query.dto';
import {
  PaginatedSolicitudesResponseDto,
  SolicitudResponseDto,
} from './dto/solicitud-response.dto';
import { toPaginatedResponse, toSolicitudResponse } from './solicitud.mapper';

@ApiTags('Solicitudes')
@ApiBearerAuth('access-token')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(
    private readonly crear: CrearSolicitudUseCase,
    private readonly consultar: ConsultarSolicitudUseCase,
    private readonly listar: ListarSolicitudesUseCase,
    private readonly actualizar: ActualizarSolicitudUseCase,
    private readonly transicionar: TransicionarSolicitudUseCase,
    private readonly finalizar: FinalizarSolicitudUseCase,
  ) {}

  // ---- POST /solicitudes ----------------------------------------------------

  @Post()
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una solicitud nueva (estado inicial DRAFT)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Clave única para evitar duplicados en reintentos.',
  })
  @ApiBody({ type: CreateSolicitudDto })
  @ApiResponse({ status: 201, type: SolicitudResponseDto })
  @ApiResponse({ status: 400, description: 'Validación fallida o Idempotency-Key faltante' })
  async create(
    @Body() dto: CreateSolicitudDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<SolicitudResponseDto> {
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new BadRequestException(
        'Header Idempotency-Key obligatorio (mínimo 8 caracteres)',
      );
    }
    const result = await this.crear.execute({
      cliente: dto.cliente,
      productoCodigo: dto.productoCodigo,
      datosFormulario: dto.datosFormulario,
      correlationId: getCorrelationId(),
      idempotencyKey,
      actor: user.id,
    });
    if (isErr(result)) throw this.toHttp(result.error);
    return toSolicitudResponse(result.value);
  }

  // ---- GET /solicitudes -----------------------------------------------------

  @Get()
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @ApiOperation({ summary: 'Listar solicitudes con filtros y paginación' })
  @ApiResponse({ status: 200, type: PaginatedSolicitudesResponseDto })
  async list(@Query() query: ListSolicitudesQueryDto): Promise<PaginatedSolicitudesResponseDto> {
    const result = await this.listar.execute({
      estado: query.estado,
      clienteNumDoc: query.clienteNumDoc,
      page: query.page ?? 1,
      size: query.size ?? 20,
    });
    return toPaginatedResponse(result);
  }

  // ---- GET /solicitudes/:id -------------------------------------------------

  @Get(':id')
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @ApiOperation({ summary: 'Consultar una solicitud por id (incluye historial)' })
  @ApiResponse({ status: 200, type: SolicitudResponseDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  async getOne(@Param('id') id: string): Promise<SolicitudResponseDto> {
    const result = await this.consultar.execute(id);
    if (isErr(result)) throw this.toHttp(result.error);
    return toSolicitudResponse(result.value);
  }

  // ---- PATCH /solicitudes/:id ----------------------------------------------

  @Patch(':id')
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @ApiOperation({
    summary: 'Actualizar datos del formulario y/o transicionar a IN_REVIEW',
    description:
      'Solo se pueden actualizar los datos cuando la solicitud está en estado DRAFT.',
  })
  @ApiResponse({ status: 200, type: SolicitudResponseDto })
  @ApiResponse({ status: 404, description: 'Solicitud no encontrada' })
  @ApiResponse({ status: 409, description: 'Transición inválida' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSolicitudDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SolicitudResponseDto> {
    const result = await this.actualizar.execute({
      id,
      datosFormulario: dto.datosFormulario,
      enviarARevision: dto.enviarARevision,
      actor: user.id,
    });
    if (isErr(result)) throw this.toHttp(result.error);
    return toSolicitudResponse(result.value);
  }

  // ---- POST /solicitudes/:id/aprobar ---------------------------------------

  @Post(':id/aprobar')
  @Roles('SUPERVISOR', 'ADMIN')
  @ApiOperation({ summary: 'Aprobar una solicitud (rol SUPERVISOR)' })
  @ApiResponse({ status: 200, type: SolicitudResponseDto })
  async aprobar(
    @Param('id') id: string,
    @Body() dto: TransitionSolicitudDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SolicitudResponseDto> {
    const result = await this.transicionar.execute({
      id,
      target: 'APPROVED',
      actor: user.id,
      motivo: dto.motivo,
    });
    if (isErr(result)) throw this.toHttp(result.error);
    return toSolicitudResponse(result.value);
  }

  // ---- POST /solicitudes/:id/rechazar --------------------------------------

  @Post(':id/rechazar')
  @Roles('SUPERVISOR', 'ADMIN')
  @ApiOperation({ summary: 'Rechazar una solicitud (rol SUPERVISOR)' })
  @ApiResponse({ status: 200, type: SolicitudResponseDto })
  async rechazar(
    @Param('id') id: string,
    @Body() dto: TransitionSolicitudDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SolicitudResponseDto> {
    const result = await this.transicionar.execute({
      id,
      target: 'REJECTED',
      actor: user.id,
      motivo: dto.motivo,
    });
    if (isErr(result)) throw this.toHttp(result.error);
    return toSolicitudResponse(result.value);
  }

  // ---- POST /solicitudes/:id/abandonar -------------------------------------

  @Post(':id/abandonar')
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @ApiOperation({ summary: 'Abandonar una solicitud (cualquier estado no terminal)' })
  @ApiResponse({ status: 200, type: SolicitudResponseDto })
  async abandonar(
    @Param('id') id: string,
    @Body() dto: TransitionSolicitudDto,
    @CurrentUser() user: AuthUser,
  ): Promise<SolicitudResponseDto> {
    const result = await this.transicionar.execute({
      id,
      target: 'ABANDONED',
      actor: user.id,
      motivo: dto.motivo,
    });
    if (isErr(result)) throw this.toHttp(result.error);
    return toSolicitudResponse(result.value);
  }

  // ---- POST /solicitudes/:id/finalizar -------------------------------------

  @Post(':id/finalizar')
  @Roles('SUPERVISOR', 'ADMIN')
  @ApiOperation({
    summary: 'Notificar al Core para apertura del producto (HU-002)',
    description:
      'Llama al gateway Mulesoft. Si Core acepta → FINALIZED con numeroProducto. ' +
      'Si rechaza con 4xx → IN_REVIEW. Si 5xx tras retries → APPROVED + pendiente.',
  })
  @ApiResponse({ status: 200, type: SolicitudResponseDto })
  @ApiResponse({ status: 422, description: 'Core rechazó por validación de negocio' })
  @ApiResponse({ status: 502, description: 'Core no disponible tras retries' })
  @ApiResponse({ status: 503, description: 'Circuit breaker abierto' })
  async finalize(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<SolicitudResponseDto> {
    const result = await this.finalizar.execute({ id, actor: user.id });
    if (isErr(result)) throw this.toHttp(result.error);
    return toSolicitudResponse(result.value);
  }

  // --------------------------------------------------------------------------

  /** Maps domain errors to HTTP exceptions; the global filter renders them as RFC 7807. */
  private toHttp(error: DomainError): Error {
    if (error instanceof SolicitudNotFoundError) return new NotFoundException(error.message);
    if (error instanceof InvalidStateTransitionError)
      return new ConflictException(error.message);
    if (error instanceof IdempotencyKeyConflictError)
      return new ConflictException(error.message);
    return error;
  }
}
