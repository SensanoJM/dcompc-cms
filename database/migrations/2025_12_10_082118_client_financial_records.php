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
        Schema::create('client_financial_records', function (Blueprint $table) {
        $table->id('record_id');
        $table->foreignId('client_id')
                ->constrained('clients', 'client_id')
                ->onDelete('cascade');
        $table->string('period'); // e.g., "2024-Q1", "Period 1", "Jan 2024"
        $table->decimal('fixed_deposit', 15, 2)->default(0.00);
        $table->decimal('savings', 15, 2)->default(0.00);
        $table->decimal('loan_balance', 15, 2)->default(0.00);
        $table->decimal('arrears', 15, 2)->default(0.00);
        $table->decimal('fines', 15, 2)->default(0.00);
        $table->decimal('mortuary', 15, 2)->default(0.00);
        $table->date('uploaded_date');
        $table->string('assigned_mediator')->nullable(); // String name, not FK
        $table->timestamps();
            
        // Unique constraint: one record per client per period
        $table->unique(['client_id', 'period'], 'unique_client_period');
            
        $table->index('period', 'idx_records_period');
        $table->index(['client_id', 'period'], 'idx_client_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('client_financial_records');
    }
};
