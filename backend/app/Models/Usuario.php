<?php

namespace App\Models;

class Usuario extends SyncModel
{
    protected $table = 'usuarios';

    protected $casts = ['activo' => 'boolean'];

    protected $hidden = ['pin_hash'];
}
