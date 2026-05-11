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
            DB::table('friend_invitations as fi')
                ->join('students as s1', 's1.id', '=', 'fi.sender_student_id')
                ->join('students as s2', 's2.id', '=', 'fi.receiver_student_id')
                ->select([
                    's1.user_id as from_user_id',
                    's2.user_id as to_user_id',
                    'fi.status',
                    'fi.accepted_at',
                    'fi.sender_seen_at',
                    'fi.created_at',
                    'fi.updated_at',
                ])
                ->orderBy('fi.id')
                ->chunk(100, function ($rows) {
                    $payload = $rows->map(function ($row) {
                        return [
                            'from_user_id' => $row->from_user_id,
                            'to_user_id' => $row->to_user_id,
                            'status' => in_array($row->status, ['accepted', 'pending'], true) ? $row->status : 'rejected',
                            'accepted_at' => $row->accepted_at,
                            'sender_seen_at' => $row->sender_seen_at,
                            'created_at' => $row->created_at,
                            'updated_at' => $row->updated_at,
                        ];
                    })->all();

                    DB::table('user_invitations')->insertOrIgnore($payload);
                });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_invitations');
    }
};
