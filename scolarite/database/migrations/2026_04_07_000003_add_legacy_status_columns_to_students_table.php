<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            // Legacy fields still referenced by some running code paths.
            if (!Schema::hasColumn('students', 'personal_info_status')) {
                $table->enum('personal_info_status', ['pending', 'accepted', 'rejected', 'in_progress'])->default('pending')->after('personnel_info_comment');
            }
            if (!Schema::hasColumn('students', 'personal_info_comment')) {
                $table->text('personal_info_comment')->nullable()->after('personal_info_status');
            }
            if (!Schema::hasColumn('students', 'certificate_status')) {
                $table->enum('certificate_status', ['pending', 'accepted', 'rejected', 'in_progress'])->default('pending')->after('certificate_achievement_comment');
            }
            if (!Schema::hasColumn('students', 'certificate_comment')) {
                $table->text('certificate_comment')->nullable()->after('certificate_status');
            }
            if (!Schema::hasColumn('students', 'transcript_status')) {
                $table->enum('transcript_status', ['pending', 'accepted', 'rejected', 'in_progress'])->default('pending')->after('academic_transcript_comment');
            }
            if (!Schema::hasColumn('students', 'transcript_comment')) {
                $table->text('transcript_comment')->nullable()->after('transcript_status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $drop = [];
            foreach ([
                'personal_info_status',
                'personal_info_comment',
                'certificate_status',
                'certificate_comment',
                'transcript_status',
                'transcript_comment',
            ] as $col) {
                if (Schema::hasColumn('students', $col)) $drop[] = $col;
            }
            if (!empty($drop)) $table->dropColumn($drop);
        });
    }
};

