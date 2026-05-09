<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('double_correction_requests', function (Blueprint $table) {
            $table->id();

            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->string('annee_scolaire', 20);
            $table->foreignId('panier_id')->constrained('paniers')->cascadeOnDelete();

            $table->foreignId('professeur_id')->constrained('professeurs')->cascadeOnDelete();

            $table->string('status', 20)->default('pending'); // pending|accepted|rejected
            $table->text('reason')->nullable();
            $table->text('decision_note')->nullable();
            $table->timestamp('decided_at')->nullable();

            $table->timestamps();

            $table->index(['class_id', 'annee_scolaire', 'panier_id'], 'idx_dc_req_class_year_panier');
            $table->index(['professeur_id', 'status'], 'idx_dc_req_prof_status');
            $table->unique(['student_id', 'class_id', 'annee_scolaire', 'panier_id'], 'uniq_double_correction_student_panier');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('double_correction_requests');
    }
};

