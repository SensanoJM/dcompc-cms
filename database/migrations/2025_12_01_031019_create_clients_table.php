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
        Schema::create('clients', function (Blueprint $table) {
            $table->id('client_id');
            $table->string('first_name');
            $table->string('last_name');
            $table->decimal('fixed_deposit', 15, 2)->default(0.00);
            $table->decimal('savings', 15, 2)->default(0.00);
            $table->decimal('loan_balance', 15, 2)->default(0.00);
            $table->decimal('arrears', 15, 2)->default(0.00);
            $table->decimal('fines', 15, 2)->default(0.00);
            $table->decimal('mortuary', 15, 2)->default(0.00);
            $table->date('uploaded_date')->default(DB::raw('CURRENT_DATE'));
            $table->string('period')->nullable();
            $table->timestamps();
            
            // Indexes
            $table->index('period', 'idx_clients_period');
            $table->index(['first_name', 'last_name'], 'idx_clients_name');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clients');
    }
};
