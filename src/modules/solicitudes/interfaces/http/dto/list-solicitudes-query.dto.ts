import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

const ESTADOS = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'FINALIZED', 'ABANDONED'] as const;
type Estado = (typeof ESTADOS)[number];

export class ListSolicitudesQueryDto {
  @ApiPropertyOptional({ enum: ESTADOS })
  @IsOptional()
  @IsEnum(ESTADOS)
  estado?: Estado;

  @ApiPropertyOptional({ description: 'Número de documento del cliente para filtrar' })
  @IsOptional()
  @IsString()
  clienteNumDoc?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size?: number = 20;
}
