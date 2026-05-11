<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('internship_soutenance_jury_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('internship_request_id')->constrained('internship_requests')->cascadeOnDelete();
            $table->foreignId('professeur_id')->constrained('professeurs')->cascadeOnDelete();
            $table->unsignedTinyInteger('position');
            $table->timestamps();

            $table->unique(['internship_request_id', 'position'], 'isjm_req_position_uq');
            $table->unique(['internship_request_id', 'professeur_id'], 'isjm_req_prof_uq');
        });

        Schema::table('internship_requests', function (Blueprint $table) {
            $table->timestamp('soutenance_published_at')->nullable()->after('soutenance_date');
        });
    }

    public function down(): void
    {
        Schema::table('internship_requests', function (Blueprint $table) {
            $table->dropColumn('soutenance_published_at');
        });
        Schema::dropIfExists('internship_soutenance_jury_members');
    }
};
