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
        Schema::create('mediation_sessions', function (Blueprint $table) {
            $table->id('session_id');
            $table->string('session_number')->unique();
            $table->date('session_date');
            $table->integer('times_scheduled')->default(1);
            $table->text('remarks')->nullable();
            $table->foreignId('created_by_user_id')
                  ->constrained('users', 'user_id')
                  ->onDelete('cascade');
            $table->timestamps();
            
            // Indexes
            $table->index('session_date', 'idx_sessions_date');
            $table->index('session_number', 'idx_sessions_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mediation_sessions');
    }
};
