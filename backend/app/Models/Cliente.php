<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cliente extends SyncModel
{
    protected $table = 'clientes';

    protected $casts = [
        'activo' => 'boolean',
        'lat' => 'float',
        'lng' => 'float',
        'orden_visita' => 'integer',
    ];

    public function ruta(): BelongsTo
    {
        return $this->belongsTo(Ruta::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }

    public function diasVisita(): HasMany
    {
        return $this->hasMany(ClienteDiaVisita::class);
    }

    public function pedidos(): HasMany
    {
        return $this->hasMany(Pedido::class);
    }
}
