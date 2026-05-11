<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('module_course_sessions') && ! Schema::hasColumn('module_course_sessions', 'panier_id')) {
            Schema::table('module_course_sessions', function (Blueprint $table) {
                $table->foreignId('panier_id')->nullable()->after('id')->constrained('paniers')->nullOnDelete();
            });
        }

        if (Schema::hasTable('module_course_sessions') && Schema::hasColumn('module_course_sessions', 'panier_id')) {
            DB::table('module_course_sessions')
                ->whereNull('panier_id')
                ->whereNotNull('module_id')
                ->orderBy('id')
                ->chunkById(100, function ($sessions) {
                    $moduleIds = $sessions->pluck('module_id')->filter()->unique()->values();
                    $panierIdsByModuleId = DB::table('modules')
                        ->whereIn('id', $moduleIds)
                        ->pluck('panier_id', 'id');

                    foreach ($sessions as $session) {
                        $panierId = $panierIdsByModuleId[$session->module_id] ?? null;
                        if ($panierId) {
                            DB::table('module_course_sessions')
                                ->where('id', $session->id)
                                ->update(['panier_id' => $panierId]);
                        }
                    }
                });
        }

        if (Schema::hasTable('module_course_sessions')) {
            Schema::table('module_course_sessions', function (Blueprint $table) {
                $table->dropForeign(['module_id']);
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE module_course_sessions MODIFY module_id BIGINT UNSIGNED NULL');
            }
            Schema::table('module_course_sessions', function (Blueprint $table) {
                $table->foreign('module_id')->references('id')->on('modules')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('student_panier_elimination_states')) {
            Schema::create('student_panier_elimination_states', function (Blueprint $table) {
                $table->id();
                $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
                $table->foreignId('panier_id')->constrained('paniers')->cascadeOnDelete();
                $table->foreignId('class_id')->constrained('classes')->cascadeOnDelete();
                $table->string('annee_scolaire', 20);
                $table->boolean('dismissed_by_prof')->default(false);
                $table->timestamps();

                $table->unique(['student_id', 'panier_id', 'class_id', 'annee_scolaire'], 'uniq_student_panier_class_year');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('student_panier_elimination_states');

        if (Schema::hasTable('module_course_sessions') && Schema::hasColumn('module_course_sessions', 'panier_id')) {
            Schema::table('module_course_sessions', function (Blueprint $table) {
                $table->dropForeign(['panier_id']);
                $table->dropColumn('panier_id');
            });
        }

        if (Schema::hasTable('module_course_sessions')) {
            // module_id may be null after down — fill from first module per row is not trivial; skip strict restore
            DB::statement('DELETE FROM module_course_sessions WHERE module_id IS NULL');
            Schema::table('module_course_sessions', function (Blueprint $table) {
                $table->dropForeign(['module_id']);
            });
            if (DB::getDriverName() === 'mysql') {
                DB::statement('ALTER TABLE module_course_sessions MODIFY module_id BIGINT UNSIGNED NOT NULL');
            }
            Schema::table('module_course_sessions', function (Blueprint $table) {
                $table->foreign('module_id')->references('id')->on('modules')->cascadeOnDelete();
            });
        }
    }
};
