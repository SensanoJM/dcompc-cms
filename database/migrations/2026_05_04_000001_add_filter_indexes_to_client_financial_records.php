<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('client_financial_records', function (Blueprint $table) {
            $table->index('arrears', 'idx_records_arrears');
            $table->index('assigned_mediator', 'idx_records_mediator');
        });
    }

    public function down(): void
    {
        Schema::table('client_financial_records', function (Blueprint $table) {
            $table->dropIndex('idx_records_arrears');
            $table->dropIndex('idx_records_mediator');
        });
    }
};
