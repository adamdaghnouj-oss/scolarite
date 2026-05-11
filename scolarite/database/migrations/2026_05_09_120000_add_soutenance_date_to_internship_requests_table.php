<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internship_requests', function (Blueprint $table) {
            $table->date('soutenance_date')->nullable()->after('deadline_attestation');
        });
    }

    public function down(): void
    {
        Schema::table('internship_requests', function (Blueprint $table) {
            $table->dropColumn('soutenance_date');
        });
    }
};
