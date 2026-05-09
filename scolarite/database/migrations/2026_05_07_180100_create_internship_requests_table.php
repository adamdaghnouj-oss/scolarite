<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('internship_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
            $table->foreignId('teammate_student_id')->nullable()->constrained('students')->nullOnDelete();
            $table->foreignId('approved_by_directeur_stage_id')->nullable()->constrained('directeurs_stage')->nullOnDelete();

            $table->string('internship_type', 30); // observation | professionnel | pfe
            $table->string('company_name', 180);
            $table->string('project_name', 180)->nullable();
            $table->text('project_description')->nullable();
            $table->date('start_date');
            $table->date('end_date');

            $table->string('status', 40)->default('draft'); // draft|signed_submitted|approved|rejected
            $table->text('director_comment')->nullable();
            $table->date('deadline_rapport')->nullable();
            $table->date('deadline_attestation')->nullable();

            $table->string('signed_demande_path')->nullable();
            $table->string('rapport_path')->nullable();
            $table->string('attestation_path')->nullable();

            $table->timestamp('signed_demande_uploaded_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('internship_requests');
    }
};
