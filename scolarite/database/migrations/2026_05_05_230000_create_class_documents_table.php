<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_documents', function (Blueprint $table) {
            $table->id();
            $table->string('type', 30); // timetable | exam_calendar
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('semestre_id')->nullable()->constrained('semestres')->nullOnDelete();
            $table->string('annee_scolaire', 20)->nullable(); // snapshot / fallback

            $table->string('title', 160)->nullable();
            $table->string('file_path', 500);
            $table->string('file_mime', 120)->nullable();
            $table->unsignedBigInteger('file_size')->nullable();

            // visibility window: doc is shown to students only when now is in [starts_at, ends_at]
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();

            $table->timestamps();

            $table->index(['type', 'class_id']);
            $table->index(['type', 'starts_at', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_documents');
    }
};

