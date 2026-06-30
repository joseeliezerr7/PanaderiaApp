<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class Ruta extends SyncModel
{
    protected $table = 'rutas';

    protected $casts = ['activa' => 'boolean'];

    public function clientes(): HasMany
    {
        return $this->hasMany(Cliente::class);
    }
}
