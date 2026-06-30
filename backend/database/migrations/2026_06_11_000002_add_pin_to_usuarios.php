<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('usuarios', function (Blueprint $t) {
            // PIN de acceso para la app móvil (login offline). 4+ dígitos.
            $t->string('pin')->nullable();
        });

        // PIN inicial para todos los usuarios existentes; el dueño lo cambia luego.
        DB::table('usuarios')->update(['pin' => '1234', 'last_modified' => now()]);
    }

    public function down(): void
    {
        Schema::table('usuarios', function (Blueprint $t) {
            $t->dropColumn('pin');
        });
    }
};
