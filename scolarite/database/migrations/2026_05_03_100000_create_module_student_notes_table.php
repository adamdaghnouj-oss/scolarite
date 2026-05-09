<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('module_student_notes')) {
            return;
        }

        Schema::create('module_student_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->string('annee_scolaire', 20);
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('professeur_id')->constrained('professeurs')->cascadeOnDelete();
            $table->decimal('note', 5, 2)->nullable();
            $table->timestamps();

            $table->unique(['module_id', 'class_id', 'annee_scolaire', 'student_id'], 'uniq_note_module_class_year_student');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('module_student_notes');
    }
};
