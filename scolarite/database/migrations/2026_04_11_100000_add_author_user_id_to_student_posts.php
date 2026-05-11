<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_posts', function (Blueprint $table) {
            $table->foreignId('author_user_id')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });

        DB::table('student_posts')
            ->whereNull('author_user_id')
            ->orderBy('id')
            ->chunkById(100, function ($posts) {
                $studentIds = $posts->pluck('student_id')->filter()->unique()->values();
                $userIdsByStudentId = DB::table('students')
                    ->whereIn('id', $studentIds)
                    ->pluck('user_id', 'id');

                foreach ($posts as $post) {
                    $authorUserId = $userIdsByStudentId[$post->student_id] ?? null;
                    if ($authorUserId) {
                        DB::table('student_posts')
                            ->where('id', $post->id)
                            ->update(['author_user_id' => $authorUserId]);
                    }
                }
            });

        Schema::table('student_posts', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
        });
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE student_posts MODIFY student_id BIGINT UNSIGNED NULL');
        }
        Schema::table('student_posts', function (Blueprint $table) {
            $table->foreign('student_id')->references('id')->on('students')->nullOnDelete();
        });

        Schema::table('student_posts', function (Blueprint $table) {
            $table->index(['author_user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('student_posts', function (Blueprint $table) {
            $table->dropForeign(['author_user_id']);
            $table->dropIndex(['author_user_id', 'created_at']);
            $table->dropColumn('author_user_id');
        });
        // Cannot safely restore NOT NULL student_id if null rows exist
    }
};
