<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // --- post likes ---
        if (! Schema::hasColumn('student_post_likes', 'user_id')) {
            Schema::table('student_post_likes', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->after('post_id')->constrained('users')->cascadeOnDelete();
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('
                    UPDATE student_post_likes l
                    INNER JOIN students s ON s.id = l.student_id
                    SET l.user_id = s.user_id
                    WHERE l.user_id IS NULL
                ');
            }
            Schema::table('student_post_likes', function (Blueprint $table) {
                $table->dropUnique(['post_id', 'student_id']);
                $table->dropForeign(['student_id']);
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE student_post_likes DROP COLUMN student_id');
                DB::statement('ALTER TABLE student_post_likes MODIFY user_id BIGINT UNSIGNED NOT NULL');
            }
            Schema::table('student_post_likes', function (Blueprint $table) {
                $table->unique(['post_id', 'user_id']);
            });
        }

        // --- comments ---
        if (! Schema::hasColumn('student_post_comments', 'author_user_id')) {
            Schema::table('student_post_comments', function (Blueprint $table) {
                $table->foreignId('author_user_id')->nullable()->after('post_id')->constrained('users')->cascadeOnDelete();
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('
                    UPDATE student_post_comments c
                    INNER JOIN students s ON s.id = c.student_id
                    SET c.author_user_id = s.user_id
                    WHERE c.author_user_id IS NULL
                ');
            }
            Schema::table('student_post_comments', function (Blueprint $table) {
                $table->dropForeign(['student_id']);
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE student_post_comments DROP COLUMN student_id');
                DB::statement('ALTER TABLE student_post_comments MODIFY author_user_id BIGINT UNSIGNED NOT NULL');
            }
        }

        // --- comment likes ---
        if (! Schema::hasColumn('student_post_comment_likes', 'user_id')) {
            Schema::table('student_post_comment_likes', function (Blueprint $table) {
                $table->foreignId('user_id')->nullable()->after('comment_id')->constrained('users')->cascadeOnDelete();
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('
                    UPDATE student_post_comment_likes l
                    INNER JOIN students s ON s.id = l.student_id
                    SET l.user_id = s.user_id
                    WHERE l.user_id IS NULL
                ');
            }
            Schema::table('student_post_comment_likes', function (Blueprint $table) {
                $table->dropUnique(['comment_id', 'student_id']);
                $table->dropForeign(['student_id']);
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE student_post_comment_likes DROP COLUMN student_id');
                DB::statement('ALTER TABLE student_post_comment_likes MODIFY user_id BIGINT UNSIGNED NOT NULL');
            }
            Schema::table('student_post_comment_likes', function (Blueprint $table) {
                $table->unique(['comment_id', 'user_id']);
            });
        }

        // --- replies ---
        if (! Schema::hasColumn('student_post_comment_replies', 'author_user_id')) {
            Schema::table('student_post_comment_replies', function (Blueprint $table) {
                $table->foreignId('author_user_id')->nullable()->after('comment_id')->constrained('users')->cascadeOnDelete();
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('
                    UPDATE student_post_comment_replies r
                    INNER JOIN students s ON s.id = r.student_id
                    SET r.author_user_id = s.user_id
                    WHERE r.author_user_id IS NULL
                ');
            }
            Schema::table('student_post_comment_replies', function (Blueprint $table) {
                $table->dropForeign(['student_id']);
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE student_post_comment_replies DROP COLUMN student_id');
                DB::statement('ALTER TABLE student_post_comment_replies MODIFY author_user_id BIGINT UNSIGNED NOT NULL');
            }
        }
    }

    public function down(): void
    {
        //
    }
};
