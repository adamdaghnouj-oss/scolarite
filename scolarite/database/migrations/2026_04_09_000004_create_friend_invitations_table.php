<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('friend_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('receiver_student_id')->constrained('students')->cascadeOnDelete();
            $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->unique(['sender_student_id', 'receiver_student_id'], 'friends_unique_direction');
            $table->index(['receiver_student_id', 'status']);
            $table->index(['sender_student_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('friend_invitations');
    }
};
