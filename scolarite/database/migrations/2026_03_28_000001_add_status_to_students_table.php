<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            if (!Schema::hasColumn('students', 'status')) {
                $table->string('status')->default('pending')->after('overall_status');
            }
            if (!Schema::hasColumn('students', 'status_comment')) {
                $table->text('status_comment')->nullable()->after('status');
            }
            if (!Schema::hasColumn('students', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('status_comment');
            }
            if (!Schema::hasColumn('students', 'last_updated_at')) {
                $table->timestamp('last_updated_at')->nullable()->after('approved_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn([
                'status',
                'status_comment',
                'approved_at',
                'last_updated_at',
            ]);
        });
    }
};
