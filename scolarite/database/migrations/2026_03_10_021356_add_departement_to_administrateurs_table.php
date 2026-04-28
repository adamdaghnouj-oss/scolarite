<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('administrateurs', function (Blueprint $table) {
            if (!Schema::hasColumn('administrateurs', 'departement')) {
                $table->string('departement')->nullable()->after('user_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('administrateurs', function (Blueprint $table) {
            $table->dropColumn('departement');
        });
    }
};
