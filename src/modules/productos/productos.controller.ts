import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { findProducto, PRODUCTOS } from './producto.catalog';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Productos')
@ApiBearerAuth('access-token')
@Controller('productos')
export class ProductosController {
  @Get()
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @ApiOperation({ summary: 'Listar el catálogo completo de productos' })
  @ApiResponse({ status: 200 })
  list() {
    return { items: PRODUCTOS, total: PRODUCTOS.length };
  }

  @Get(':codigo')
  @Roles('ASESOR', 'SUPERVISOR', 'ADMIN')
  @ApiOperation({ summary: 'Detalle de un producto (incluye formSchema para el wizard)' })
  getOne(@Param('codigo') codigo: string) {
    const p = findProducto(codigo);
    if (!p) throw new NotFoundException(`Producto ${codigo} no existe`);
    return p;
  }
}
