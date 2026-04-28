<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('friend_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('receiver_student_id')->constrained('students')->cascadeOnDelete();
            $table->text('body')->nullable();
            $table->string('image_path')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['sender_student_id', 'receiver_student_id']);
            $table->index(['receiver_student_id', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('friend_messages');
    }
};
