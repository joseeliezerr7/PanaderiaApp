<?php

namespace App\Http\Controllers;

use App\Models\Cliente;
use App\Models\ClienteDiaVisita;
use App\Models\Pedido;
use App\Models\PedidoLinea;
use App\Models\PrecioProducto;
use App\Models\Producto;
use App\Models\Ruta;
use App\Models\SyncModel;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Implementa el protocolo de sincronización de WatermelonDB.
 *
 * Pull:  GET  /api/sync/pull?last_pulled_at=<ms epoch|null>
 *        -> { changes: { tabla: { created: [], updated: [], deleted: [ids] } }, timestamp: <ms> }
 * Push:  POST /api/sync/push?last_pulled_at=<ms>  body: { tabla: { created: [...], updated: [...], deleted: [ids] } }
 *
 * Resolución de conflictos: last-write-wins (gana el push del dispositivo,
 * el servidor sella last_modified con su propio reloj).
 */
class SyncController extends Controller
{
    /** @var array<string, class-string<SyncModel>> tablas expuestas a la app móvil */
    private const TABLAS = [
        'rutas' => Ruta::class,
        'usuarios' => Usuario::class,
        'clientes' => Cliente::class,
        'cliente_dias_visita' => ClienteDiaVisita::class,
        'productos' => Producto::class,
        'precios_producto' => PrecioProducto::class,
        'pedidos' => Pedido::class,
        'pedido_lineas' => PedidoLinea::class,
    ];

    /** Solo estas tablas aceptan escrituras desde el dispositivo. */
    private const ESCRIBIBLES = ['clientes', 'cliente_dias_visita', 'pedidos', 'pedido_lineas'];

    public function pull(Request $request): JsonResponse
    {
        $lastPulledAt = $request->query('last_pulled_at');
        // Margen de 2 s: last_modified tiene precision de segundos, asi que un
        // cambio en el mismo segundo del pull anterior podria perderse. Reenviar
        // de mas es inocuo (el upsert del dispositivo es idempotente).
        $desde = ($lastPulledAt && $lastPulledAt !== 'null')
            ? \DateTimeImmutable::createFromFormat('U', (string) intdiv((int) $lastPulledAt, 1000))->modify('-2 seconds')
            : null;

        // Sellar el timestamp ANTES de leer, para no perder cambios concurrentes.
        $timestamp = (int) round(microtime(true) * 1000);

        $changes = [];
        foreach (self::TABLAS as $tabla => $modelo) {
            $q = $modelo::withTrashed();
            if ($desde) {
                $q->where('last_modified', '>', $desde);
            }
            $vivos = [];
            $borrados = [];
            foreach ($q->get() as $reg) {
                if ($reg->deleted_at !== null) {
                    $borrados[] = $reg->id;
                } else {
                    $vivos[] = $this->serializar($reg);
                }
            }
            $changes[$tabla] = [
                'created' => $desde ? [] : $vivos,
                'updated' => $desde ? $vivos : [],
                'deleted' => $borrados,
            ];
        }

        return response()->json(['changes' => $changes, 'timestamp' => $timestamp]);
    }

    public function push(Request $request): JsonResponse
    {
        $changes = $request->json()->all();

        DB::transaction(function () use ($changes) {
            foreach (self::ESCRIBIBLES as $tabla) {
                if (! isset($changes[$tabla])) {
                    continue;
                }
                $modelo = self::TABLAS[$tabla];
                $cambios = $changes[$tabla];

                foreach (array_merge($cambios['created'] ?? [], $cambios['updated'] ?? []) as $raw) {
                    $datos = $this->limpiar($raw);
                    $reg = $modelo::withTrashed()->find($datos['id']);
                    if ($reg) {
                        $reg->fill($datos);
                        if ($reg->trashed()) {
                            $reg->restore();
                        }
                        $reg->save();
                    } else {
                        $modelo::create($datos);
                    }
                }

                foreach ($cambios['deleted'] ?? [] as $id) {
                    $modelo::find($id)?->delete();
                }
            }
        });

        return response()->json(['ok' => true]);
    }

    private function serializar(SyncModel $reg): array
    {
        $datos = $reg->makeVisible($reg->getHidden())->attributesToArray();
        unset($datos['deleted_at'], $datos['pin_hash']);
        // WatermelonDB espera epoch ms en los campos de fecha-hora
        foreach (['created_at', 'last_modified'] as $campo) {
            if (! empty($datos[$campo])) {
                $datos[$campo] = $reg->{$campo}?->getTimestampMs();
            }
        }

        return $datos;
    }

    /** Quita metacampos de WatermelonDB y campos que el dispositivo no controla. */
    private function limpiar(array $raw): array
    {
        unset(
            $raw['_status'], $raw['_changed'],
            $raw['created_at'], $raw['last_modified'], $raw['deleted_at'],
        );

        return $raw;
    }
}
