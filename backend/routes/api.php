<?php

use App\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

// TODO: proteger con auth:sanctum cuando se implemente el login de vendedores.
Route::get('/sync/pull', [SyncController::class, 'pull']);
Route::post('/sync/push', [SyncController::class, 'push']);
