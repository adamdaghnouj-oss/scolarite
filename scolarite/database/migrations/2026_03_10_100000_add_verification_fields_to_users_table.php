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
        Schema::table('users', function (Blueprint $table) {
            $table->string('verification_code')->nullable()->after('email');
            $table->timestamp('verification_code_expires_at')->nullable()->after('verification_code');
            $table->boolean('is_verified')->default(false)->after('verification_code_expires_at');
            $table->integer('verification_attempts')->default(0)->after('is_verified');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'verification_code',
                'verification_code_expires_at',
                'is_verified',
                'verification_attempts',
            ]);
        });
    }
};
