<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::middleware(['auth','verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // API endpoints for clients (used by SPA table)
    Route::get('/api/clients', [\App\Http\Controllers\Api\ClientController::class, 'index']);
    Route::get('/api/clients/{id}', [\App\Http\Controllers\ClientController::class, 'show']);
});

require __DIR__.'/settings.php';
