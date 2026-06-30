<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Base de todas las tablas sincronizables con la app móvil:
 * PK uuid (puede venir generado desde el dispositivo), soft delete,
 * y last_modified como marca para el protocolo pull/push.
 */
abstract class SyncModel extends Model
{
    use HasUuids;
    use SoftDeletes;

    public const UPDATED_AT = 'last_modified';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];
}
