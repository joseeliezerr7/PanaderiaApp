<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Producto extends SyncModel
{
    protected $table = 'productos';

    protected $casts = ['activo' => 'boolean', 'orden' => 'integer'];

    public function precios(): HasMany
    {
        return $this->hasMany(PrecioProducto::class);
    }

    public function precioVigente(): ?float
    {
        $p = $this->precios()
            ->whereDate('vigente_desde', '<=', now())
            ->orderByDesc('vigente_desde')
            ->first();

        return $p?->precio !== null ? (float) $p->precio : null;
    }
}
