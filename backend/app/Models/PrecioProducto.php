<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrecioProducto extends SyncModel
{
    protected $table = 'precios_producto';

    protected $casts = ['precio' => 'decimal:2', 'vigente_desde' => 'date'];

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }
}
