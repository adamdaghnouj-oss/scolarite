<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('class_grade_publications')) {
            return;
        }

        Schema::create('class_grade_publications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->string('annee_scolaire', 20);
            $table->timestamp('published_at')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['class_id', 'annee_scolaire'], 'uniq_class_grade_publication_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_grade_publications');
    }
};
