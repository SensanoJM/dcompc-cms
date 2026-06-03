<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

// OLD (Private):
// Route::get('/', function () {
//     return Inertia::render('welcome', [
//         'canRegister' => Features::enabled(Features::registration()),
//     ]);
// })->name('home');

// Route::middleware(['auth','verified'])->group(function () {
//     Route::get('dashboard', function () {
//         return Inertia::render('dashboard');
//     })->name('dashboard');

//     // API endpoints for clients (used by SPA table)
//     Route::get('/api/clients', [\App\Http\Controllers\Api\ClientController::class, 'index']);
//     Route::get('/api/clients/{id}', [\App\Http\Controllers\ClientController::class, 'show']);
//     // Excel import endpoint used by client table
//     Route::post('/api/excel/import', [\App\Http\Controllers\ExcelController::class, 'import']);
// });

// NEW (Public):
Route::get('/', function () {
    return Inertia::render('dashboard');
})->name('dashboard');

Route::get('/clients', [\App\Http\Controllers\ClientController::class, 'index'])->name('clients');
Route::post('/clients/import', [\App\Http\Controllers\ExcelController::class, 'importWeb'])->name('clients.import');
Route::post('/clients/batch-schedule', [\App\Http\Controllers\ClientController::class, 'batchSchedule'])->name('clients.batch-schedule');
Route::post('/clients/batch-delete', [\App\Http\Controllers\ClientController::class, 'batchDestroy'])->name('clients.batch-delete');

Route::delete('/clients/{id}', [\App\Http\Controllers\ClientController::class, 'destroy'])->name('clients.destroy');

Route::get('/mediation', [\App\Http\Controllers\SessionController::class, 'index'])->name('mediation');


// API endpoints for clients (used by SPA table)
Route::get('/api/clients', [\App\Http\Controllers\Api\ClientController::class, 'index']);
Route::get('/api/clients/{id}', [\App\Http\Controllers\Api\ClientController::class, 'show']);
// Excel import endpoint used by client table
Route::post('/api/excel/import', [\App\Http\Controllers\ExcelController::class, 'import']);

require __DIR__ . '/settings.php';
