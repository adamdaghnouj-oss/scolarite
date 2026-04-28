<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');

            // Personal info
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('postal_code')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('place_of_birth')->nullable();
            $table->string('gender')->nullable(); // male, female
            $table->string('profile_picture')->nullable(); // path

            // Academic
            $table->unsignedBigInteger('class_id')->nullable(); // chosen class from DB
            $table->foreign('class_id')->references('id')->on('classes')->onDelete('set null');
            $table->string('admission_status')->nullable(); // admis, refused, first_year

            // Documents
            $table->string('payment_proof')->nullable(); // path
            $table->string('certificate_achievement')->nullable(); // path
            $table->string('academic_transcript')->nullable(); // path

            // Father info
            $table->string('father_first_name')->nullable();
            $table->string('father_last_name')->nullable();
            $table->string('father_phone')->nullable();
            $table->string('father_email')->nullable();
            $table->string('father_address')->nullable();
            $table->string('father_postal_code')->nullable();
            $table->string('father_city')->nullable();
            $table->string('father_country')->nullable();
            $table->date('father_date_of_birth')->nullable();
            $table->string('father_job')->nullable();
            $table->string('father_place_of_job')->nullable();
            $table->string('father_condition')->nullable(); // alive, deceased
            $table->date('father_date_of_death')->nullable();

            // Mother info
            $table->string('mother_first_name')->nullable();
            $table->string('mother_last_name')->nullable();
            $table->string('mother_phone')->nullable();
            $table->string('mother_email')->nullable();
            $table->string('mother_address')->nullable();
            $table->string('mother_postal_code')->nullable();
            $table->string('mother_city')->nullable();
            $table->string('mother_country')->nullable();
            $table->date('mother_date_of_birth')->nullable();
            $table->string('mother_job')->nullable();
            $table->string('mother_place_of_job')->nullable();
            $table->string('mother_condition')->nullable(); // alive, deceased
            $table->date('mother_date_of_death')->nullable();

            // Parents relationship
            $table->string('parents_relationship')->nullable(); // married, divorced

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_profiles');
    }
};
