<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internship_requests', function (Blueprint $table) {
            $table->foreignId('encadrant_professeur_id')->nullable()->after('soutenance_published_at')->constrained('professeurs')->nullOnDelete();
            $table->date('encadrement_start_date')->nullable()->after('encadrant_professeur_id');
            $table->date('encadrement_end_date')->nullable()->after('encadrement_start_date');
        });
    }

    public function down(): void
    {
        Schema::table('internship_requests', function (Blueprint $table) {
            $table->dropForeign(['encadrant_professeur_id']);
            $table->dropColumn(['encadrant_professeur_id', 'encadrement_start_date', 'encadrement_end_date']);
        });
    }
};
