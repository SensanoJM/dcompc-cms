<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mediation_sessions', function (Blueprint $table) {
            $table->dropForeign(['created_by_user_id']);
            $table->unsignedBigInteger('created_by_user_id')->nullable()->change();
            $table->foreign('created_by_user_id')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('mediation_sessions', function (Blueprint $table) {
            $table->dropForeign(['created_by_user_id']);
            $table->unsignedBigInteger('created_by_user_id')->nullable(false)->change();
            $table->foreign('created_by_user_id')
                ->references('user_id')
                ->on('users')
                ->onDelete('cascade');
        });
    }
};
