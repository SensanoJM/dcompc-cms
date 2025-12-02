<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('session_clients', function (Blueprint $table) {
            $table->id('session_client_id');
            $table->foreignId('session_id')
                  ->constrained('mediation_sessions', 'session_id')
                  ->onDelete('cascade');
            $table->foreignId('client_id')
                  ->constrained('clients', 'client_id')
                  ->onDelete('cascade');
            $table->timestamp('assigned_at')->useCurrent();
            
            // Composite unique constraint
            $table->unique(['session_id', 'client_id'], 'unique_session_client');
            
            // Indexes
            $table->index('session_id', 'idx_session_clients_session');
            $table->index('client_id', 'idx_session_clients_client');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('session_clients');
    }
};
