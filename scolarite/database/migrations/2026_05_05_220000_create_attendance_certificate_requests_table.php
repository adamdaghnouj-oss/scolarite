<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_certificate_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->cascadeOnDelete();
            $table->foreignId('professeur1_id')->constrained('professeurs')->restrictOnDelete();
            $table->foreignId('professeur2_id')->constrained('professeurs')->restrictOnDelete();

            $table->string('language', 5)->default('fr'); // fr|en|ar
            $table->unsignedInteger('copies')->default(1);

            $table->string('status', 20)->default('pending'); // pending|accepted|rejected
            $table->unsignedBigInteger('accepted_by_professeur_id')->nullable();
            $table->foreign('accepted_by_professeur_id', 'acr_accepted_by_fk')
                ->references('id')->on('professeurs')
                ->nullOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('rejected_at')->nullable();

            $table->timestamps();
        });

        Schema::create('attendance_certificate_approvals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('attendance_certificate_request_id');
            $table->foreign('attendance_certificate_request_id', 'acr_req_fk')
                ->references('id')->on('attendance_certificate_requests')
                ->cascadeOnDelete();

            $table->unsignedBigInteger('professeur_id');
            $table->foreign('professeur_id', 'acr_prof_fk')
                ->references('id')->on('professeurs')
                ->cascadeOnDelete();
            $table->string('decision', 20)->default('pending'); // pending|accepted|rejected
            $table->timestamp('decided_at')->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamps();

            $table->unique(['attendance_certificate_request_id', 'professeur_id'], 'acr_prof_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_certificate_approvals');
        Schema::dropIfExists('attendance_certificate_requests');
    }
};

