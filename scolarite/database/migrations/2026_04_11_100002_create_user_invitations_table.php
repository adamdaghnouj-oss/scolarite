<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('pending'); // pending, accepted, rejected
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('sender_seen_at')->nullable();
            $table->timestamps();
            $table->unique(['from_user_id', 'to_user_id']);
            $table->index(['to_user_id', 'status']);
            $table->index(['from_user_id', 'status']);
        });

        if (Schema::hasTable('friend_invitations')) {
            DB::statement('
                INSERT IGNORE INTO user_invitations (from_user_id, to_user_id, status, accepted_at, sender_seen_at, created_at, updated_at)
                SELECT s1.user_id, s2.user_id,
                    CASE fi.status
                        WHEN "accepted" THEN "accepted"
                        WHEN "pending" THEN "pending"
                        ELSE "rejected"
                    END,
                    fi.accepted_at, fi.sender_seen_at, fi.created_at, fi.updated_at
                FROM friend_invitations fi
                INNER JOIN students s1 ON s1.id = fi.sender_student_id
                INNER JOIN students s2 ON s2.id = fi.receiver_student_id
            ');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_invitations');
    }
};
