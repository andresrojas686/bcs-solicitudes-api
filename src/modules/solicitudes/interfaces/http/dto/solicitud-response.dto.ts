import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CambioEstadoResponseDto {
  @ApiProperty() estadoAnterior!: string;
  @ApiProperty() estadoNuevo!: string;
  @ApiProperty() actor!: string;
  @ApiPropertyOptional() motivo?: string;
  @ApiProperty({ type: String, format: 'date-time' }) timestamp!: string;
}

export class ClienteRefResponseDto {
  @ApiProperty() tipoDoc!: string;
  @ApiProperty() numDoc!: string;
}

export class SolicitudResponseDto {
  @ApiProperty({ example: 'sol_aBcDeF123456' }) id!: string;
  @ApiProperty({ type: ClienteRefResponseDto }) cliente!: ClienteRefResponseDto;
  @ApiProperty({ example: 'AHO-001' }) productoCodigo!: string;
  @ApiProperty({
    enum: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'FINALIZED', 'ABANDONED'],
  })
  estado!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  datosFormulario!: Record<string, unknown>;
  @ApiProperty({ type: [CambioEstadoResponseDto] })
  historicoEstados!: CambioEstadoResponseDto[];
  @ApiProperty() correlationId!: string;
  @ApiPropertyOptional() numeroProducto?: string;
  @ApiPropertyOptional() motivoRechazo?: string;
  @ApiProperty({ default: false }) pendienteEnvioCore!: boolean;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty() version!: number;
}

export class PaginatedSolicitudesResponseDto {
  @ApiProperty({ type: [SolicitudResponseDto] }) items!: SolicitudResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() size!: number;
}
