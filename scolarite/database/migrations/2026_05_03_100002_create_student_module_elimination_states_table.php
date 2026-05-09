<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('student_module_elimination_states')) {
            return;
        }

        Schema::create('student_module_elimination_states', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->string('annee_scolaire', 20);
            /** When true, professor dismissed elimination while count may still be >= 3 */
            $table->boolean('dismissed_by_prof')->default(false);
            $table->timestamps();

            $table->unique(['student_id', 'module_id', 'class_id', 'annee_scolaire'], 'uniq_elim_state');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_module_elimination_states');
    }
};
