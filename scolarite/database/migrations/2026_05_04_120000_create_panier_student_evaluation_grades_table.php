<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('panier_student_evaluation_grades')) {
            return;
        }

        Schema::create('panier_student_evaluation_grades', function (Blueprint $table) {
            $table->id();
            $table->foreignId('panier_id')->constrained('paniers')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->string('annee_scolaire', 20);
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            /** Normalized evaluation type (e.g. ds, examen, tp) — one grade per student per panier per type */
            $table->string('evaluation_type', 40);
            $table->decimal('note', 5, 2)->nullable();
            $table->foreignId('professeur_id')->constrained('professeurs')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(
                ['panier_id', 'class_id', 'annee_scolaire', 'student_id', 'evaluation_type'],
                'uniq_panier_class_year_student_eval'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('panier_student_evaluation_grades');
    }
};
