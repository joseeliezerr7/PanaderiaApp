export interface Ruta {
  id: string;
  nombre: string;
  activa: number;
}

export interface Usuario {
  id: string;
  nombre: string;
  rol: string;
  pin: string | null;
  activo: number;
}

export interface Cliente {
  id: string;
  nombre: string;
  negocio: string | null;
  direccion: string | null;
  telefono: string | null;
  lat: number | null;
  lng: number | null;
  ruta_id: string | null;
  orden_visita: number | null;
  usuario_id: string | null;
  activo: number;
}

export interface Producto {
  id: string;
  nombre: string;
  orden: number;
  activo: number;
  precio?: number; // precio vigente (join)
}

export interface Pedido {
  id: string;
  cliente_id: string;
  usuario_id: string | null;
  fecha: string;
  estado: 'borrador' | 'enviado' | 'entregado' | 'cancelado';
  nota: string | null;
}

export interface PedidoLinea {
  id: string;
  pedido_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  devolucion_anterior: number;
}
