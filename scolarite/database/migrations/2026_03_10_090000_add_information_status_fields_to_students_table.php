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
            // Personnel Information Status
            $table->enum('personnel_info_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('gender');
            $table->text('personnel_info_comment')->nullable()->after('personnel_info_status');
            
            // Academic Information Status
            $table->enum('academic_info_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('admission_status');
            $table->text('academic_info_comment')->nullable()->after('academic_info_status');
            
            // Payment Proof Status
            $table->enum('payment_proof_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('payment_proof');
            $table->text('payment_proof_comment')->nullable()->after('payment_proof_status');
            
            // Certificate of Achievement Status
            $table->enum('certificate_achievement_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('certificate_achievement');
            $table->text('certificate_achievement_comment')->nullable()->after('certificate_achievement_status');
            
            // Academic Transcript Status
            $table->enum('academic_transcript_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('academic_transcript');
            $table->text('academic_transcript_comment')->nullable()->after('academic_transcript_status');
            
            // Father Information Status
            $table->enum('father_info_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('father_condition');
            $table->text('father_info_comment')->nullable()->after('father_info_status');
            
            // Mother Information Status
            $table->enum('mother_info_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('mother_condition');
            $table->text('mother_info_comment')->nullable()->after('mother_info_status');
            
            // Parents Relationship Status
            $table->enum('parents_relationship_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('parents_relationship');
            $table->text('parents_relationship_comment')->nullable()->after('parents_relationship_status');
            
            // Overall status
            $table->enum('overall_status', ['pending', 'accepted', 'rejected'])->default('pending')->after('parents_relationship_comment');
            $table->timestamp('last_updated_at')->nullable()->after('overall_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn([
                'personnel_info_status',
                'personnel_info_comment',
                'academic_info_status',
                'academic_info_comment',
                'payment_proof_status',
                'payment_proof_comment',
                'certificate_achievement_status',
                'certificate_achievement_comment',
                'academic_transcript_status',
                'academic_transcript_comment',
                'father_info_status',
                'father_info_comment',
                'mother_info_status',
                'mother_info_comment',
                'parents_relationship_status',
                'parents_relationship_comment',
                'overall_status',
                'last_updated_at',
            ]);
        });
    }
};
