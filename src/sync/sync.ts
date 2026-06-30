import NetInfo from '@react-native-community/netinfo';
import { type SQLiteDatabase } from 'expo-sqlite';
import { getServerUrl } from '../store/ajustes';

/**
 * Motor de sincronización offline-first.
 * Habla el protocolo pull/push del backend Laravel (estilo WatermelonDB):
 *   GET  /api/sync/pull?last_pulled_at=<ms|null>
 *   POST /api/sync/push?last_pulled_at=<ms>
 *
 * Regla de conflictos: un registro local con _dirty=1 no se pisa en el pull;
 * se subirá en el próximo push (gana el dispositivo, igual que en el servidor).
 */

// columnas que viajan al servidor, por tabla (solo tablas escribibles)
const ESCRIBIBLES: Record<string, string[]> = {
  clientes: ['id', 'nombre', 'negocio', 'direccion', 'telefono', 'lat', 'lng', 'ruta_id', 'orden_visita', 'usuario_id', 'activo'],
  cliente_dias_visita: ['id', 'cliente_id', 'dia_num'],
  pedidos: ['id', 'cliente_id', 'usuario_id', 'fecha', 'estado', 'nota'],
  pedido_lineas: ['id', 'pedido_id', 'producto_id', 'cantidad', 'precio_unitario', 'devolucion_anterior'],
};

// columnas que se aceptan del servidor, por tabla (en orden seguro de FK)
const LEGIBLES: Record<string, string[]> = {
  rutas: ['id', 'nombre', 'activa'],
  usuarios: ['id', 'nombre', 'rol', 'pin', 'activo'],
  clientes: ESCRIBIBLES.clientes,
  cliente_dias_visita: ESCRIBIBLES.cliente_dias_visita,
  productos: ['id', 'nombre', 'orden', 'activo'],
  precios_producto: ['id', 'producto_id', 'precio', 'vigente_desde'],
  pedidos: ESCRIBIBLES.pedidos,
  pedido_lineas: ESCRIBIBLES.pedido_lineas,
};

export interface ResultadoSync {
  ok: boolean;
  detalle: string;
  subidos: number;
  bajados: number;
}

let sincronizando = false;

export async function sincronizar(db: SQLiteDatabase): Promise<ResultadoSync> {
  if (sincronizando) return { ok: false, detalle: 'Sincronización ya en curso', subidos: 0, bajados: 0 };
  sincronizando = true;
  try {
    const red = await NetInfo.fetch();
    if (!red.isConnected) {
      return { ok: false, detalle: 'Sin conexión — los cambios quedan guardados en el teléfono', subidos: 0, bajados: 0 };
    }
    const base = (await getServerUrl()).replace(/\/+$/, '');
    const lastPulledAt = await leerMeta(db, 'last_pulled_at');

    const subidos = await push(db, base, lastPulledAt);
    const bajados = await pull(db, base, lastPulledAt);

    await escribirMeta(db, 'last_sync_en', new Date().toISOString());
    return { ok: true, detalle: 'Sincronizado', subidos, bajados };
  } catch (e: any) {
    return { ok: false, detalle: `Error de sincronización: ${e?.message ?? e}`, subidos: 0, bajados: 0 };
  } finally {
    sincronizando = false;
  }
}

async function push(db: SQLiteDatabase, base: string, lastPulledAt: string | null): Promise<number> {
  const cambios: Record<string, { created: any[]; updated: any[]; deleted: string[] }> = {};
  let total = 0;

  for (const [tabla, columnas] of Object.entries(ESCRIBIBLES)) {
    const sucios = await db.getAllAsync<any>(
      `SELECT * FROM ${tabla} WHERE _dirty = 1 AND _deleted = 0`,
    );
    const borrados = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM ${tabla} WHERE _deleted = 1`,
    );
    if (!sucios.length && !borrados.length) continue;

    cambios[tabla] = {
      created: [],
      // el servidor hace upsert, así que todo lo sucio viaja como "updated"
      updated: sucios.map((r) => {
        const limpio: any = {};
        for (const c of columnas) limpio[c] = r[c] ?? null;
        if (tabla === 'pedidos') limpio.fecha = String(limpio.fecha).slice(0, 10);
        return limpio;
      }),
      deleted: borrados.map((r) => r.id),
    };
    total += sucios.length + borrados.length;
  }

  if (!total) return 0;

  const res = await fetch(`${base}/api/sync/push?last_pulled_at=${lastPulledAt ?? 0}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(cambios),
  });
  if (!res.ok) throw new Error(`push HTTP ${res.status}`);

  // confirmado por el servidor: limpiar marcas y purgar borrados
  await db.withTransactionAsync(async () => {
    for (const tabla of Object.keys(cambios)) {
      await db.runAsync(`UPDATE ${tabla} SET _dirty = 0 WHERE _dirty = 1 AND _deleted = 0`);
      await db.runAsync(`DELETE FROM ${tabla} WHERE _deleted = 1`);
    }
  });
  return total;
}

async function pull(db: SQLiteDatabase, base: string, lastPulledAt: string | null): Promise<number> {
  const res = await fetch(
    `${base}/api/sync/pull?last_pulled_at=${lastPulledAt ?? 'null'}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`pull HTTP ${res.status}`);
  const { changes, timestamp } = await res.json();

  let total = 0;
  await db.withTransactionAsync(async () => {
    for (const [tabla, columnas] of Object.entries(LEGIBLES)) {
      const c = changes[tabla];
      if (!c) continue;

      for (const registro of [...(c.created ?? []), ...(c.updated ?? [])]) {
        // no pisar cambios locales pendientes de subir
        const local = await db.getFirstAsync<{ _dirty: number }>(
          `SELECT _dirty FROM ${tabla} WHERE id = ?`, [registro.id],
        );
        if (local?._dirty) continue;

        const valores = columnas.map((col) => normalizar(registro[col]));
        await db.runAsync(
          `INSERT OR REPLACE INTO ${tabla} (${columnas.join(', ')}, _dirty, _deleted)
           VALUES (${columnas.map(() => '?').join(', ')}, 0, 0)`,
          valores,
        );
        total++;
      }

      for (const id of c.deleted ?? []) {
        await db.runAsync(`DELETE FROM ${tabla} WHERE id = ?`, [id]);
        total++;
      }
    }
    await db.runAsync(
      `INSERT OR REPLACE INTO sync_meta (clave, valor) VALUES ('last_pulled_at', ?)`,
      [String(timestamp)],
    );
  });
  return total;
}

function normalizar(v: unknown): string | number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' || typeof v === 'string') return v;
  return String(v);
}

export async function leerMeta(db: SQLiteDatabase, clave: string): Promise<string | null> {
  const fila = await db.getFirstAsync<{ valor: string }>(
    'SELECT valor FROM sync_meta WHERE clave = ?', [clave],
  );
  return fila?.valor ?? null;
}

export async function escribirMeta(db: SQLiteDatabase, clave: string, valor: string) {
  await db.runAsync('INSERT OR REPLACE INTO sync_meta (clave, valor) VALUES (?, ?)', [clave, valor]);
}

export async function contarPendientes(db: SQLiteDatabase): Promise<number> {
  let total = 0;
  for (const tabla of Object.keys(ESCRIBIBLES)) {
    const fila = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${tabla} WHERE _dirty = 1 OR _deleted = 1`,
    );
    total += fila?.n ?? 0;
  }
  return total;
}

/** Sincroniza en segundo plano sin bloquear la UI (errores silenciosos). */
export function sincronizarEnFondo(db: SQLiteDatabase) {
  void sincronizar(db);
}

/** Re-sincroniza automáticamente al recuperar la conexión. */
export function vigilarConexion(db: SQLiteDatabase): () => void {
  return NetInfo.addEventListener((estado) => {
    if (estado.isConnected) sincronizarEnFondo(db);
  });
}
