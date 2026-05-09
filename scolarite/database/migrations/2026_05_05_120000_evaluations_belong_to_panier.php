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

        // Denormalize panier from module
        DB::statement('
            UPDATE evaluations e
            INNER JOIN modules m ON m.id = e.module_id
            SET e.panier_id = m.panier_id
            WHERE e.module_id IS NOT NULL AND e.panier_id IS NULL
        ');

        // Drop FK on module_id so we can null it and dedupe
        Schema::table('evaluations', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
        });

        DB::statement('ALTER TABLE evaluations MODIFY module_id BIGINT UNSIGNED NULL');

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

        DB::statement('ALTER TABLE evaluations MODIFY module_id BIGINT UNSIGNED NOT NULL');

        Schema::table('evaluations', function (Blueprint $table) {
            $table->foreign('module_id')->references('id')->on('modules')->cascadeOnDelete();
        });
    }
};
