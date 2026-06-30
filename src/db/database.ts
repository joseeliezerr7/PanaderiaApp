import { type SQLiteDatabase } from 'expo-sqlite';

/**
 * Esquema local (espejo del servidor Laravel).
 * Columnas de control de sincronización:
 *   _dirty   1 = tiene cambios locales pendientes de subir
 *   _deleted 1 = borrado local pendiente de propagar
 */
export async function migrar(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS rutas (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      activa INTEGER NOT NULL DEFAULT 1,
      _dirty INTEGER NOT NULL DEFAULT 0,
      _deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'vendedor',
      pin TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      _dirty INTEGER NOT NULL DEFAULT 0,
      _deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      negocio TEXT,
      direccion TEXT,
      telefono TEXT,
      lat REAL,
      lng REAL,
      ruta_id TEXT,
      orden_visita INTEGER,
      usuario_id TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      _dirty INTEGER NOT NULL DEFAULT 0,
      _deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_clientes_ruta ON clientes (ruta_id, orden_visita);

    CREATE TABLE IF NOT EXISTS cliente_dias_visita (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      dia_num INTEGER NOT NULL,
      _dirty INTEGER NOT NULL DEFAULT 0,
      _deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_dias_cliente ON cliente_dias_visita (cliente_id);
    CREATE INDEX IF NOT EXISTS idx_dias_dia ON cliente_dias_visita (dia_num);

    CREATE TABLE IF NOT EXISTS productos (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      _dirty INTEGER NOT NULL DEFAULT 0,
      _deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS precios_producto (
      id TEXT PRIMARY KEY,
      producto_id TEXT NOT NULL,
      precio REAL NOT NULL,
      vigente_desde TEXT NOT NULL,
      _dirty INTEGER NOT NULL DEFAULT 0,
      _deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_precios_producto ON precios_producto (producto_id, vigente_desde);

    CREATE TABLE IF NOT EXISTS pedidos (
      id TEXT PRIMARY KEY,
      cliente_id TEXT NOT NULL,
      usuario_id TEXT,
      fecha TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'borrador',
      nota TEXT,
      _dirty INTEGER NOT NULL DEFAULT 0,
      _deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos (cliente_id, fecha);
    CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos (fecha);

    CREATE TABLE IF NOT EXISTS pedido_lineas (
      id TEXT PRIMARY KEY,
      pedido_id TEXT NOT NULL,
      producto_id TEXT NOT NULL,
      cantidad INTEGER NOT NULL DEFAULT 0,
      precio_unitario REAL NOT NULL,
      devolucion_anterior INTEGER NOT NULL DEFAULT 0,
      _dirty INTEGER NOT NULL DEFAULT 0,
      _deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_lineas_pedido ON pedido_lineas (pedido_id);

    CREATE TABLE IF NOT EXISTS sync_meta (
      clave TEXT PRIMARY KEY,
      valor TEXT
    );

    -- registro local de visitas sin venta (no se sincroniza por ahora)
    CREATE TABLE IF NOT EXISTS visitas (
      cliente_id TEXT NOT NULL,
      fecha TEXT NOT NULL,
      PRIMARY KEY (cliente_id, fecha)
    );
  `);

  // Migraciones de columnas para bases ya creadas (ALTER falla si ya existe).
  await agregarColumnaSiFalta(db, 'usuarios', 'pin', 'TEXT');
}

async function agregarColumnaSiFalta(
  db: SQLiteDatabase, tabla: string, columna: string, tipo: string,
) {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tabla})`);
  if (!cols.some((c) => c.name === columna)) {
    await db.execAsync(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo}`);
  }
}

export function hoyISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Día de visita: 1=lunes ... 7=domingo (JS: 0=domingo). */
export function diaNumHoy(): number {
  return ((new Date().getDay() + 6) % 7) + 1;
}

export const NOMBRES_DIA: Record<number, string> = {
  1: 'lunes', 2: 'martes', 3: 'miércoles', 4: 'jueves',
  5: 'viernes', 6: 'sábado', 7: 'domingo',
};
