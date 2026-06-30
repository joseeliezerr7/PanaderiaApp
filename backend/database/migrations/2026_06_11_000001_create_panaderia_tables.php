<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rutas', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->text('nombre')->unique();
            $t->boolean('activa')->default(true);
            $t->timestampTz('created_at')->useCurrent();
            $t->timestampTz('last_modified')->useCurrent()->index();
            $t->timestampTz('deleted_at')->nullable();
        });

        Schema::create('usuarios', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->text('nombre');
            $t->string('rol')->default('vendedor');
            $t->text('pin_hash')->nullable();
            $t->boolean('activo')->default(true);
            $t->timestampTz('created_at')->useCurrent();
            $t->timestampTz('last_modified')->useCurrent()->index();
            $t->timestampTz('deleted_at')->nullable();
        });

        Schema::create('clientes', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->text('nombre');
            $t->text('negocio')->nullable();
            $t->text('direccion')->nullable();
            $t->text('telefono')->nullable();
            $t->double('lat')->nullable();
            $t->double('lng')->nullable();
            $t->foreignUuid('ruta_id')->nullable()->constrained('rutas');
            $t->integer('orden_visita')->nullable();
            $t->foreignUuid('usuario_id')->nullable()->constrained('usuarios');
            $t->boolean('activo')->default(true);
            $t->text('legacy_identificador')->nullable()->unique();
            $t->timestampTz('created_at')->useCurrent();
            $t->timestampTz('last_modified')->useCurrent()->index();
            $t->timestampTz('deleted_at')->nullable();
        });

        Schema::create('cliente_dias_visita', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('cliente_id')->constrained('clientes');
            $t->unsignedTinyInteger('dia_num'); // 1=lunes .. 7=domingo
            $t->timestampTz('created_at')->useCurrent();
            $t->timestampTz('last_modified')->useCurrent()->index();
            $t->timestampTz('deleted_at')->nullable();
            $t->unique(['cliente_id', 'dia_num']);
        });

        Schema::create('productos', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->text('nombre');
            $t->integer('orden')->default(0);
            $t->boolean('activo')->default(true);
            $t->text('legacy_identificador')->nullable()->unique();
            $t->timestampTz('created_at')->useCurrent();
            $t->timestampTz('last_modified')->useCurrent()->index();
            $t->timestampTz('deleted_at')->nullable();
        });

        Schema::create('precios_producto', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('producto_id')->constrained('productos');
            $t->decimal('precio', 10, 2);
            $t->date('vigente_desde');
            $t->timestampTz('created_at')->useCurrent();
            $t->timestampTz('last_modified')->useCurrent()->index();
            $t->timestampTz('deleted_at')->nullable();
            $t->unique(['producto_id', 'vigente_desde']);
        });

        Schema::create('pedidos', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('cliente_id')->constrained('clientes');
            $t->foreignUuid('usuario_id')->nullable()->constrained('usuarios');
            $t->date('fecha')->index();
            $t->string('estado')->default('borrador'); // borrador|enviado|entregado|cancelado
            $t->text('nota')->nullable();
            $t->text('legacy_identificadorventa')->nullable();
            $t->decimal('legacy_totalventa', 10, 2)->nullable();
            $t->timestampTz('created_at')->useCurrent();
            $t->timestampTz('last_modified')->useCurrent()->index();
            $t->timestampTz('deleted_at')->nullable();
            $t->index(['cliente_id', 'fecha']);
        });

        Schema::create('pedido_lineas', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('pedido_id')->constrained('pedidos')->cascadeOnDelete();
            $t->foreignUuid('producto_id')->constrained('productos');
            $t->integer('cantidad');
            $t->decimal('precio_unitario', 10, 2);
            $t->integer('devolucion_anterior')->default(0);
            $t->timestampTz('created_at')->useCurrent();
            $t->timestampTz('last_modified')->useCurrent()->index();
            $t->timestampTz('deleted_at')->nullable();
            $t->unique(['pedido_id', 'producto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pedido_lineas');
        Schema::dropIfExists('pedidos');
        Schema::dropIfExists('precios_producto');
        Schema::dropIfExists('productos');
        Schema::dropIfExists('cliente_dias_visita');
        Schema::dropIfExists('clientes');
        Schema::dropIfExists('usuarios');
        Schema::dropIfExists('rutas');
    }
};
