import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSolicitudDto {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Reemplaza los datos del formulario (solo válido en estado DRAFT)',
  })
  @IsOptional()
  @IsObject()
  datosFormulario?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Si true, transiciona la solicitud de DRAFT a IN_REVIEW',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enviarARevision?: boolean;
}
