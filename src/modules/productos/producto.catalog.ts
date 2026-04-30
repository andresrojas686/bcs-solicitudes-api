import type { TipoProducto } from '../solicitudes/domain/ports/core-banking.port';

export interface FormFieldSpec {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'currency';
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
}

export interface Producto {
  codigo: string;
  nombre: string;
  tipo: TipoProducto;
  descripcion: string;
  requisitos: string[];
  /** Spec del wizard frontend: campos que debe llenar el cliente. */
  formSchema: FormFieldSpec[];
}

/**
 * Catálogo seed (3 productos). Hardcoded para esta prueba; en producción vendría
 * de Mongo o del Core. El frontend consume este catálogo para parametrizar el wizard.
 */
export const PRODUCTOS: Producto[] = [
  {
    codigo: 'AHO-001',
    nombre: 'Cuenta de Ahorros Plus',
    tipo: 'CUENTA_AHORROS',
    descripcion: 'Cuenta de ahorros con rendimiento competitivo y sin cuota de manejo el primer año.',
    requisitos: ['Mayor de edad', 'Documento vigente', 'KYC aprobado'],
    formSchema: [
      { name: 'montoInicial', label: 'Monto inicial de apertura (COP)', type: 'currency', required: true, min: 50000 },
      { name: 'sucursalPreferida', label: 'Sucursal preferida', type: 'select', required: true, options: ['CHAPINERO', 'CENTRO', 'NORTE', 'OCCIDENTE', 'SUR'] },
    ],
  },
  {
    codigo: 'TC-001',
    nombre: 'Tarjeta de Crédito Clásica',
    tipo: 'TARJETA_CREDITO',
    descripcion: 'Tarjeta de crédito Visa Clásica con cupo desde 2 millones.',
    requisitos: ['Mayor de edad', 'Ingresos mensuales mínimos COP $1.200.000', 'KYC aprobado'],
    formSchema: [
      { name: 'ingresosMensuales', label: 'Ingresos mensuales (COP)', type: 'currency', required: true, min: 1200000 },
      { name: 'cupoSolicitado', label: 'Cupo solicitado (COP)', type: 'currency', required: true, min: 2000000, max: 50000000 },
      { name: 'tipoEmpleo', label: 'Tipo de empleo', type: 'select', required: true, options: ['EMPLEADO', 'INDEPENDIENTE', 'PENSIONADO'] },
    ],
  },
  {
    codigo: 'LI-001',
    nombre: 'Crédito de Libre Inversión',
    tipo: 'CREDITO_LIBRE_INVERSION',
    descripcion: 'Crédito de libre destinación con plazos hasta 60 meses.',
    requisitos: ['Mayor de edad', 'Ingresos demostrables', 'Score crediticio aceptable'],
    formSchema: [
      { name: 'monto', label: 'Monto solicitado (COP)', type: 'currency', required: true, min: 1000000, max: 100000000 },
      { name: 'plazoMeses', label: 'Plazo (meses)', type: 'number', required: true, min: 12, max: 60 },
      { name: 'destino', label: 'Destino del crédito', type: 'select', required: true, options: ['EDUCACION', 'VIVIENDA', 'CONSOLIDACION', 'EMPRENDIMIENTO', 'OTRO'] },
      { name: 'ingresosMensuales', label: 'Ingresos mensuales (COP)', type: 'currency', required: true, min: 1500000 },
    ],
  },
];

export function findProducto(codigo: string): Producto | undefined {
  return PRODUCTOS.find((p) => p.codigo === codigo);
}
