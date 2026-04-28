<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('class_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
            $table->foreignId('sender_student_id')->constrained('students')->cascadeOnDelete();
            $table->text('body')->nullable();
            $table->string('image_path')->nullable();
            $table->string('audio_path')->nullable();
            $table->timestamps();

            $table->index(['class_id', 'id']);
            $table->index(['sender_student_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('class_messages');
    }
};

