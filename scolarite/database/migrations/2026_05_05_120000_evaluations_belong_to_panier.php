<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('evaluations')) {
            return;
        }

        if (! Schema::hasColumn('evaluations', 'panier_id')) {
            Schema::table('evaluations', function (Blueprint $table) {
                $table->foreignId('panier_id')->nullable()->after('id')->constrained('paniers')->cascadeOnDelete();
            });
        }

        // Denormalize panier from module.
        DB::table('evaluations')
            ->whereNotNull('module_id')
            ->whereNull('panier_id')
            ->orderBy('id')
            ->chunkById(100, function ($evaluations) {
                $moduleIds = $evaluations->pluck('module_id')->filter()->unique()->values();
                $panierIdsByModuleId = DB::table('modules')
                    ->whereIn('id', $moduleIds)
                    ->pluck('panier_id', 'id');

                foreach ($evaluations as $evaluation) {
                    $panierId = $panierIdsByModuleId[$evaluation->module_id] ?? null;
                    if ($panierId) {
                        DB::table('evaluations')
                            ->where('id', $evaluation->id)
                            ->update(['panier_id' => $panierId]);
                    }
                }
            });

        // Drop FK on module_id so we can null it and dedupe
        Schema::table('evaluations', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE evaluations MODIFY module_id BIGINT UNSIGNED NULL');
        }

        Schema::table('evaluations', function (Blueprint $table) {
            $table->foreign('module_id')->references('id')->on('modules')->nullOnDelete();
        });

        // One row per (panier, type); keep smallest id per group
        $rows = DB::table('evaluations')->whereNotNull('panier_id')->orderBy('id')->get();
        $seen = [];
        foreach ($rows as $row) {
            $k = $row->panier_id.'|'.strtolower((string) $row->type);
            if (isset($seen[$k])) {
                DB::table('evaluations')->where('id', $row->id)->delete();
            } else {
                $seen[$k] = true;
            }
        }

        DB::table('evaluations')->whereNotNull('panier_id')->update(['module_id' => null]);
    }

    public function down(): void
    {
        if (! Schema::hasColumn('evaluations', 'panier_id')) {
            return;
        }

        // Cannot reliably restore module_id from panier
        Schema::table('evaluations', function (Blueprint $table) {
            $table->dropForeign(['panier_id']);
            $table->dropColumn('panier_id');
        });

        Schema::table('evaluations', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE evaluations MODIFY module_id BIGINT UNSIGNED NOT NULL');
        }

        Schema::table('evaluations', function (Blueprint $table) {
            $table->foreign('module_id')->references('id')->on('modules')->cascadeOnDelete();
        });
    }
};
