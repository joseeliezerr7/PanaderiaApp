<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Pedido extends SyncModel
{
    public const ESTADOS = ['borrador', 'enviado', 'entregado', 'cancelado'];

    protected $table = 'pedidos';

    protected $casts = ['fecha' => 'date', 'legacy_totalventa' => 'decimal:2'];

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class);
    }

    public function lineas(): HasMany
    {
        return $this->hasMany(PedidoLinea::class);
    }

    /** El total SIEMPRE se calcula desde las líneas (nunca se almacena). */
    public function totalNeto(): float
    {
        return (float) $this->lineas()
            ->selectRaw('COALESCE(SUM((cantidad - devolucion_anterior) * precio_unitario), 0) as t')
            ->value('t');
    }
}
