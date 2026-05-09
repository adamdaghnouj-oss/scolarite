<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('module_course_sessions')) {
            Schema::create('module_course_sessions', function (Blueprint $table) {
                $table->id();
                $table->foreignId('module_id')->constrained('modules')->cascadeOnDelete();
                $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
                $table->string('annee_scolaire', 20);
                $table->foreignId('professeur_id')->constrained('professeurs')->cascadeOnDelete();
                $table->date('session_date');
                $table->time('time_start');
                $table->time('time_end');
                $table->timestamps();

                $table->index(['module_id', 'class_id', 'annee_scolaire'], 'idx_session_module_class_year');
            });
        }

        if (! Schema::hasTable('module_session_attendance')) {
            Schema::create('module_session_attendance', function (Blueprint $table) {
                $table->id();
                $table->foreignId('module_course_session_id')
                    ->constrained('module_course_sessions')
                    ->cascadeOnDelete();
                $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
                $table->string('status', 16); // present | absent
                $table->timestamps();

                $table->unique(['module_course_session_id', 'student_id'], 'uniq_attendance_session_student');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('module_session_attendance');
        Schema::dropIfExists('module_course_sessions');
    }
};
