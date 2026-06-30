<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Siembra la base con los CSV generados por migracion/etl.py.
 * Ruta de los CSV: env LEGACY_CSV_PATH o ../migracion/output relativo al proyecto.
 */
class LegacySeeder extends Seeder
{
    private function csv(string $tabla): array
    {
        $dir = env('LEGACY_CSV_PATH', base_path('../migracion/output'));
        $path = $dir . DIRECTORY_SEPARATOR . $tabla . '.csv';
        $fh = fopen($path, 'r');
        $header = fgetcsv($fh);
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]); // BOM
        $rows = [];
        while (($r = fgetcsv($fh)) !== false) {
            $rows[] = array_combine($header, $r);
        }
        fclose($fh);

        return $rows;
    }

    private static function bool(string $v): bool
    {
        return in_array(strtolower($v), ['true', '1', 't'], true);
    }

    private static function nullable(string $v): ?string
    {
        return $v === '' ? null : $v;
    }

    private static function nullableInt(string $v): ?int
    {
        return $v === '' ? null : (int) (float) $v;
    }

    private function insertChunked(string $tabla, array $rows): void
    {
        $now = now();
        foreach (array_chunk($rows, 500) as $chunk) {
            foreach ($chunk as &$r) {
                $r['created_at'] ??= $now;
                $r['last_modified'] ??= $now;
            }
            DB::table($tabla)->insert($chunk);
        }
        $this->command->info("$tabla: " . count($rows));
    }

    public function run(): void
    {
        $this->insertChunked('usuarios', array_map(fn ($r) => [
            'id' => $r['id'],
            'nombre' => $r['nombre'],
            'rol' => $r['rol'],
            'activo' => true,
        ], $this->csv('usuarios')));

        $this->insertChunked('rutas', array_map(fn ($r) => [
            'id' => $r['id'],
            'nombre' => $r['nombre'],
            'activa' => self::bool($r['activa']),
        ], $this->csv('rutas')));

        $this->insertChunked('productos', array_map(fn ($r) => [
            'id' => $r['id'],
            'nombre' => $r['nombre'],
            'orden' => (int) $r['orden'],
            'activo' => self::bool($r['activo']),
            'legacy_identificador' => $r['legacy_identificador'],
        ], $this->csv('productos')));

        $this->insertChunked('precios_producto', array_map(fn ($r) => [
            'id' => $r['id'],
            'producto_id' => $r['producto_id'],
            'precio' => (float) $r['precio'],
            'vigente_desde' => $r['vigente_desde'],
        ], $this->csv('precios_producto')));

        $this->insertChunked('clientes', array_map(fn ($r) => [
            'id' => $r['id'],
            'nombre' => $r['nombre'],
            'negocio' => self::nullable($r['negocio']),
            'direccion' => self::nullable($r['direccion']),
            'telefono' => self::nullable($r['telefono']),
            'lat' => $r['lat'] === '' ? null : (float) $r['lat'],
            'lng' => $r['lng'] === '' ? null : (float) $r['lng'],
            'ruta_id' => self::nullable($r['ruta_id']),
            'orden_visita' => self::nullableInt($r['orden_visita']),
            'usuario_id' => self::nullable($r['usuario_id']),
            'activo' => self::bool($r['activo']),
            'legacy_identificador' => $r['legacy_identificador'],
        ], $this->csv('clientes')));

        $this->insertChunked('cliente_dias_visita', array_map(fn ($r) => [
            'id' => (string) Str::uuid(),
            'cliente_id' => $r['cliente_id'],
            'dia_num' => (int) $r['dia_num'],
        ], $this->csv('cliente_dias_visita')));

        $this->insertChunked('pedidos', array_map(fn ($r) => [
            'id' => $r['id'],
            'cliente_id' => $r['cliente_id'],
            'usuario_id' => self::nullable($r['usuario_id']),
            'fecha' => $r['fecha'],
            'estado' => $r['estado'],
            'legacy_identificadorventa' => $r['legacy_identificadorventa'],
            'legacy_totalventa' => (float) $r['legacy_totalventa'],
            'created_at' => $r['fecha'] . ' 00:00:00',
            'last_modified' => $r['fecha'] . ' 00:00:00',
        ], $this->csv('pedidos')));

        $this->insertChunked('pedido_lineas', array_map(fn ($r) => [
            'id' => $r['id'],
            'pedido_id' => $r['pedido_id'],
            'producto_id' => $r['producto_id'],
            'cantidad' => (int) $r['cantidad'],
            'precio_unitario' => (float) $r['precio_unitario'],
            'devolucion_anterior' => (int) $r['devolucion_anterior'],
        ], $this->csv('pedido_lineas')));
    }
}
