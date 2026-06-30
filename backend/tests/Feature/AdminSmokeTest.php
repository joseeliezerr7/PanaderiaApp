<?php

namespace Tests\Feature;

use App\Models\Cliente;
use App\Models\ClienteDiaVisita;
use App\Models\Pedido;
use App\Models\PedidoLinea;
use App\Models\PrecioProducto;
use App\Models\Producto;
use App\Models\Ruta;
use App\Models\User;
use App\Models\Usuario;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Livewire\Livewire;
use Tests\TestCase;

class AdminSmokeTest extends TestCase
{
    use RefreshDatabase;

    private function datosBase(): Pedido
    {
        $ruta = Ruta::create(['id' => (string) Str::uuid(), 'nombre' => 'Catacamas']);
        $vendedor = Usuario::create(['id' => (string) Str::uuid(), 'nombre' => 'henry', 'rol' => 'vendedor']);
        $cliente = Cliente::create([
            'id' => (string) Str::uuid(), 'nombre' => 'Maribel', 'ruta_id' => $ruta->id,
            'usuario_id' => $vendedor->id, 'orden_visita' => 1,
        ]);
        $producto = Producto::create(['id' => (string) Str::uuid(), 'nombre' => 'semita de yema', 'orden' => 1]);
        PrecioProducto::create([
            'id' => (string) Str::uuid(), 'producto_id' => $producto->id,
            'precio' => 12.20, 'vigente_desde' => '2024-04-19',
        ]);
        $pedido = Pedido::create([
            'id' => (string) Str::uuid(), 'cliente_id' => $cliente->id,
            'usuario_id' => $vendedor->id, 'fecha' => '2026-06-11', 'estado' => 'enviado',
        ]);
        PedidoLinea::create([
            'id' => (string) Str::uuid(), 'pedido_id' => $pedido->id, 'producto_id' => $producto->id,
            'cantidad' => 10, 'precio_unitario' => 12.20, 'devolucion_anterior' => 2,
        ]);

        return $pedido;
    }

    public function test_paginas_admin_cargan(): void
    {
        $this->datosBase();
        $admin = User::factory()->create();

        foreach (['clientes', 'pedidos', 'productos', 'rutas', 'usuarios'] as $pagina) {
            $this->actingAs($admin)->get("/admin/$pagina")->assertOk();
        }

        // los listados muestran los nombres, no solo IDs (las tablas cargan vía Livewire)
        $this->actingAs($admin);
        Livewire::test(\App\Filament\Resources\Productos\Pages\ListProductos::class)
            ->call('loadTable')
            ->assertSee('semita de yema')
            ->assertSee('12.20');
        Livewire::test(\App\Filament\Resources\Rutas\Pages\ListRutas::class)
            ->call('loadTable')
            ->assertSee('Catacamas');
        Livewire::test(\App\Filament\Resources\Usuarios\Pages\ListUsuarios::class)
            ->call('loadTable')
            ->assertSee('henry');
    }

    public function test_editar_pedido_muestra_cliente_y_lineas(): void
    {
        $pedido = $this->datosBase();
        $admin = User::factory()->create();

        $this->actingAs($admin)
            ->get("/admin/pedidos/{$pedido->id}/edit")
            ->assertOk()
            ->assertSee('Maribel')           // cliente en el select
            ->assertSee('henry')             // vendedor
            ->assertSee('semita de yema')    // producto en las líneas
            ->assertSee('97.60')             // subtotal (10-2)*12.20 = total del pedido
            ->assertSee('Total (L)');        // campo de total en el formulario
    }

    public function test_editar_cliente_muestra_ruta_vendedor_y_dias(): void
    {
        $this->datosBase();
        $cliente = Cliente::first();
        ClienteDiaVisita::create(['cliente_id' => $cliente->id, 'dia_num' => 2]);
        $admin = User::factory()->create();

        $this->actingAs($admin)
            ->get("/admin/clientes/{$cliente->id}/edit")
            ->assertOk()
            ->assertSee('Catacamas')   // nombre de la ruta, no su uuid
            ->assertSee('henry')       // nombre del vendedor
            ->assertSee('martes');     // días de visita

        // editar los días: quitar martes, poner viernes y sábado
        Livewire::test(
            \App\Filament\Resources\Clientes\Pages\EditCliente::class,
            ['record' => $cliente->id],
        )->fillForm(['dias_visita' => ['5', '6']])
            ->call('save')
            ->assertHasNoFormErrors();

        $dias = $cliente->fresh()->diasVisita()->pluck('dia_num')->sort()->values()->all();
        $this->assertSame([5, 6], $dias);
    }

    public function test_ruta_muestra_clientes_y_permite_reordenar(): void
    {
        $this->datosBase();
        $ruta = Ruta::first();
        $c1 = Cliente::first();
        $c2 = Cliente::create([
            'id' => (string) Str::uuid(), 'nombre' => 'Don Tilo', 'ruta_id' => $ruta->id,
            'orden_visita' => 2,
        ]);
        $admin = User::factory()->create();

        // la página de la ruta lista sus clientes
        $this->actingAs($admin)
            ->get("/admin/rutas/{$ruta->id}/edit")
            ->assertOk()
            ->assertSee('Maribel')
            ->assertSee('Don Tilo');

        // reordenar por arrastre actualiza orden_visita
        Livewire::test(
            \App\Filament\Resources\Rutas\RelationManagers\ClientesRelationManager::class,
            ['ownerRecord' => $ruta, 'pageClass' => \App\Filament\Resources\Rutas\Pages\EditRuta::class],
        )->call('reorderTable', [$c2->id, $c1->id]);

        $this->assertSame(1, $c2->fresh()->orden_visita);
        $this->assertSame(2, $c1->fresh()->orden_visita);
    }

    public function test_total_pedido_se_calcula_desde_lineas(): void
    {
        $pedido = $this->datosBase();
        $this->assertSame((10 - 2) * 12.20, $pedido->totalNeto());
    }

    public function test_sync_pull_y_push(): void
    {
        $pedido = $this->datosBase();

        $pull = $this->getJson('/api/sync/pull?last_pulled_at=null')->assertOk()->json();
        $this->assertSame($pedido->id, $pull['changes']['pedidos']['created'][0]['id']);
        $this->assertArrayHasKey('timestamp', $pull);

        $nuevoId = (string) Str::uuid();
        $this->postJson('/api/sync/push?last_pulled_at=' . $pull['timestamp'], [
            'pedidos' => [
                'created' => [[
                    'id' => $nuevoId, '_status' => 'created', '_changed' => '',
                    'cliente_id' => $pedido->cliente_id, 'usuario_id' => $pedido->usuario_id,
                    'fecha' => '2026-06-12', 'estado' => 'borrador',
                ]],
                'updated' => [], 'deleted' => [],
            ],
        ])->assertOk();
        $this->assertDatabaseHas('pedidos', ['id' => $nuevoId, 'estado' => 'borrador']);

        // el pull incremental devuelve lo recién pusheado (margen de 2 s incluido)
        $pull2 = $this->getJson('/api/sync/pull?last_pulled_at=' . $pull['timestamp'])->assertOk()->json();
        $ids = array_column($pull2['changes']['pedidos']['updated'], 'id');
        $this->assertContains($nuevoId, $ids);

        // borrado desde el dispositivo -> soft delete y se propaga como deleted
        $this->postJson('/api/sync/push?last_pulled_at=' . $pull2['timestamp'], [
            'pedidos' => ['created' => [], 'updated' => [], 'deleted' => [$nuevoId]],
        ])->assertOk();
        $this->assertSoftDeleted('pedidos', ['id' => $nuevoId]);

        $pull3 = $this->getJson('/api/sync/pull?last_pulled_at=' . $pull2['timestamp'])->assertOk()->json();
        $this->assertContains($nuevoId, $pull3['changes']['pedidos']['deleted']);
    }

    public function test_push_no_escribe_tablas_de_catalogo(): void
    {
        $this->datosBase();
        $this->postJson('/api/sync/push?last_pulled_at=0', [
            'productos' => [
                'created' => [['id' => (string) Str::uuid(), 'nombre' => 'hackeado', 'orden' => 99]],
                'updated' => [], 'deleted' => [],
            ],
        ])->assertOk();
        $this->assertDatabaseMissing('productos', ['nombre' => 'hackeado']);
    }
}
