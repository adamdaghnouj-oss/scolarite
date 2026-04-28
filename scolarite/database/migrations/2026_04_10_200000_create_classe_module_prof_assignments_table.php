<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('classe_module_prof_assignments')) {
            return;
        }

        Schema::create('classe_module_prof_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
            $table->string('annee_scolaire', 20);
            $table->foreignId('professeur_cours_id')->nullable()->constrained('professeurs')->nullOnDelete();
            $table->foreignId('professeur_tp_id')->nullable()->constrained('professeurs')->nullOnDelete();
            $table->timestamps();

            $table->unique(['class_id', 'module_id', 'annee_scolaire'], 'uniq_class_module_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('classe_module_prof_assignments');
    }
};
