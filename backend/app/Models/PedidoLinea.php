<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PedidoLinea extends SyncModel
{
    protected $table = 'pedido_lineas';

    protected $casts = [
        'cantidad' => 'integer',
        'devolucion_anterior' => 'integer',
        'precio_unitario' => 'decimal:2',
    ];

    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
