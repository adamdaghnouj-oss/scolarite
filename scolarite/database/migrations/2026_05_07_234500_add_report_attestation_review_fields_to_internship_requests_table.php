<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internship_requests', function (Blueprint $table) {
            $table->string('rapport_status', 30)->default('not_uploaded')->after('rapport_path');
            $table->string('attestation_status', 30)->default('not_uploaded')->after('attestation_path');
            $table->text('rapport_review_comment')->nullable()->after('attestation_status');
            $table->text('attestation_review_comment')->nullable()->after('rapport_review_comment');
            $table->timestamp('rapport_reviewed_at')->nullable()->after('attestation_review_comment');
            $table->timestamp('attestation_reviewed_at')->nullable()->after('rapport_reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('internship_requests', function (Blueprint $table) {
            $table->dropColumn([
                'rapport_status',
                'attestation_status',
                'rapport_review_comment',
                'attestation_review_comment',
                'rapport_reviewed_at',
                'attestation_reviewed_at',
            ]);
        });
    }
};
