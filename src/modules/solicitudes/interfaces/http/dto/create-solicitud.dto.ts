import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const TIPOS_DOC = ['CC', 'CE', 'NIT', 'PAS', 'TI'] as const;
type TipoDoc = (typeof TIPOS_DOC)[number];

class ClienteRefDto {
  @ApiProperty({ enum: TIPOS_DOC, example: 'CC' })
  @IsEnum(TIPOS_DOC)
  tipoDoc!: TipoDoc;

  @ApiProperty({ example: '1111111111', minLength: 6, maxLength: 12 })
  @IsString()
  @Matches(/^[0-9]{6,12}$/, { message: 'numDoc debe ser numérico de 6-12 dígitos' })
  numDoc!: string;
}

export class CreateSolicitudDto {
  @ApiProperty({ type: ClienteRefDto })
  @ValidateNested()
  @Type(() => ClienteRefDto)
  cliente!: ClienteRefDto;

  @ApiProperty({ example: 'AHO-001', description: 'Código del producto del catálogo' })
  @IsString()
  @Length(3, 32)
  productoCodigo!: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Datos del formulario específico del producto',
  })
  @IsOptional()
  @IsObject()
  datosFormulario?: Record<string, unknown>;
}
