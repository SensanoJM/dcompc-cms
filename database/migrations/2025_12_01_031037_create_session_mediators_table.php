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
        Schema::create('session_mediators', function (Blueprint $table) {
            $table->id('session_mediator_id');
            $table->foreignId('session_id')
                  ->constrained('mediation_sessions', 'session_id')
                  ->onDelete('cascade');
            $table->foreignId('mediator_user_id')
                  ->constrained('users', 'user_id')
                  ->onDelete('cascade');
            $table->timestamp('assigned_at')->useCurrent();
            
            // Composite unique constraint
            $table->unique(['session_id', 'mediator_user_id'], 'unique_session_mediator');
            
            // Indexes
            $table->index('session_id', 'idx_session_mediators_session');
            $table->index('mediator_user_id', 'idx_session_mediators_mediator');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('session_mediators');
    }
};
