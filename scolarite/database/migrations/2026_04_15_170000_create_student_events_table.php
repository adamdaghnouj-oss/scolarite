<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('author_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('event_type', 80)->nullable();
            $table->string('title', 180);
            $table->text('description');
            $table->string('place', 160)->nullable();
            $table->dateTime('event_at')->nullable();
            $table->string('image_path')->nullable();
            $table->timestamps();
            $table->index(['created_at']);
            $table->index(['event_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_events');
    }
};
