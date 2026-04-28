<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'password_reset_code')) {
                $table->string('password_reset_code')->nullable()->after('verification_attempts');
            }
            if (!Schema::hasColumn('users', 'password_reset_code_expires_at')) {
                $table->timestamp('password_reset_code_expires_at')->nullable()->after('password_reset_code');
            }
            if (!Schema::hasColumn('users', 'password_reset_attempts')) {
                $table->integer('password_reset_attempts')->default(0)->after('password_reset_code_expires_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $cols = [];
            foreach (['password_reset_code', 'password_reset_code_expires_at', 'password_reset_attempts'] as $c) {
                if (Schema::hasColumn('users', $c)) $cols[] = $c;
            }
            if (!empty($cols)) $table->dropColumn($cols);
        });
    }
};

