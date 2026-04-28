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

        DB::statement('
            UPDATE student_posts p
            INNER JOIN students s ON s.id = p.student_id
            SET p.author_user_id = s.user_id
            WHERE p.author_user_id IS NULL
        ');

        Schema::table('student_posts', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
        });
        DB::statement('ALTER TABLE student_posts MODIFY student_id BIGINT UNSIGNED NULL');
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
