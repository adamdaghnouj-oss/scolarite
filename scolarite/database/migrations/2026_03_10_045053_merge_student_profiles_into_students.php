<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add profile columns to students table
        Schema::table('students', function (Blueprint $table) {
            if (!Schema::hasColumn('students', 'phone')) $table->string('phone')->nullable()->after('classe');
            if (!Schema::hasColumn('students', 'address')) $table->string('address')->nullable();
            if (!Schema::hasColumn('students', 'postal_code')) $table->string('postal_code')->nullable();
            if (!Schema::hasColumn('students', 'city')) $table->string('city')->nullable();
            if (!Schema::hasColumn('students', 'country')) $table->string('country')->nullable();
            if (!Schema::hasColumn('students', 'date_of_birth')) $table->date('date_of_birth')->nullable();
            if (!Schema::hasColumn('students', 'place_of_birth')) $table->string('place_of_birth')->nullable();
            if (!Schema::hasColumn('students', 'gender')) $table->string('gender')->nullable();
            if (!Schema::hasColumn('students', 'profile_picture')) $table->string('profile_picture')->nullable();
            if (!Schema::hasColumn('students', 'admission_status')) $table->string('admission_status')->nullable();
            if (!Schema::hasColumn('students', 'payment_proof')) $table->string('payment_proof')->nullable();
            if (!Schema::hasColumn('students', 'certificate_achievement')) $table->string('certificate_achievement')->nullable();
            if (!Schema::hasColumn('students', 'academic_transcript')) $table->string('academic_transcript')->nullable();

            // Father
            if (!Schema::hasColumn('students', 'father_first_name')) $table->string('father_first_name')->nullable();
            if (!Schema::hasColumn('students', 'father_last_name')) $table->string('father_last_name')->nullable();
            if (!Schema::hasColumn('students', 'father_phone')) $table->string('father_phone')->nullable();
            if (!Schema::hasColumn('students', 'father_email')) $table->string('father_email')->nullable();
            if (!Schema::hasColumn('students', 'father_address')) $table->string('father_address')->nullable();
            if (!Schema::hasColumn('students', 'father_postal_code')) $table->string('father_postal_code')->nullable();
            if (!Schema::hasColumn('students', 'father_city')) $table->string('father_city')->nullable();
            if (!Schema::hasColumn('students', 'father_country')) $table->string('father_country')->nullable();
            if (!Schema::hasColumn('students', 'father_date_of_birth')) $table->date('father_date_of_birth')->nullable();
            if (!Schema::hasColumn('students', 'father_job')) $table->string('father_job')->nullable();
            if (!Schema::hasColumn('students', 'father_place_of_job')) $table->string('father_place_of_job')->nullable();
            if (!Schema::hasColumn('students', 'father_condition')) $table->string('father_condition')->nullable();
            if (!Schema::hasColumn('students', 'father_date_of_death')) $table->date('father_date_of_death')->nullable();

            // Mother
            if (!Schema::hasColumn('students', 'mother_first_name')) $table->string('mother_first_name')->nullable();
            if (!Schema::hasColumn('students', 'mother_last_name')) $table->string('mother_last_name')->nullable();
            if (!Schema::hasColumn('students', 'mother_phone')) $table->string('mother_phone')->nullable();
            if (!Schema::hasColumn('students', 'mother_email')) $table->string('mother_email')->nullable();
            if (!Schema::hasColumn('students', 'mother_address')) $table->string('mother_address')->nullable();
            if (!Schema::hasColumn('students', 'mother_postal_code')) $table->string('mother_postal_code')->nullable();
            if (!Schema::hasColumn('students', 'mother_city')) $table->string('mother_city')->nullable();
            if (!Schema::hasColumn('students', 'mother_country')) $table->string('mother_country')->nullable();
            if (!Schema::hasColumn('students', 'mother_date_of_birth')) $table->date('mother_date_of_birth')->nullable();
            if (!Schema::hasColumn('students', 'mother_job')) $table->string('mother_job')->nullable();
            if (!Schema::hasColumn('students', 'mother_place_of_job')) $table->string('mother_place_of_job')->nullable();
            if (!Schema::hasColumn('students', 'mother_condition')) $table->string('mother_condition')->nullable();
            if (!Schema::hasColumn('students', 'mother_date_of_death')) $table->date('mother_date_of_death')->nullable();

            // Parents relationship
            if (!Schema::hasColumn('students', 'parents_relationship')) $table->string('parents_relationship')->nullable();
        });

        // Copy data from student_profiles to students
        DB::statement('
            UPDATE students s
            JOIN student_profiles sp ON s.id = sp.student_id
            SET
                s.phone = sp.phone,
                s.address = sp.address,
                s.postal_code = sp.postal_code,
                s.city = sp.city,
                s.country = sp.country,
                s.date_of_birth = sp.date_of_birth,
                s.place_of_birth = sp.place_of_birth,
                s.gender = sp.gender,
                s.profile_picture = sp.profile_picture,
                s.admission_status = sp.admission_status,
                s.payment_proof = sp.payment_proof,
                s.certificate_achievement = sp.certificate_achievement,
                s.academic_transcript = sp.academic_transcript,
                s.father_first_name = sp.father_first_name,
                s.father_last_name = sp.father_last_name,
                s.father_phone = sp.father_phone,
                s.father_email = sp.father_email,
                s.father_address = sp.father_address,
                s.father_postal_code = sp.father_postal_code,
                s.father_city = sp.father_city,
                s.father_country = sp.father_country,
                s.father_date_of_birth = sp.father_date_of_birth,
                s.father_job = sp.father_job,
                s.father_place_of_job = sp.father_place_of_job,
                s.father_condition = sp.father_condition,
                s.father_date_of_death = sp.father_date_of_death,
                s.mother_first_name = sp.mother_first_name,
                s.mother_last_name = sp.mother_last_name,
                s.mother_phone = sp.mother_phone,
                s.mother_email = sp.mother_email,
                s.mother_address = sp.mother_address,
                s.mother_postal_code = sp.mother_postal_code,
                s.mother_city = sp.mother_city,
                s.mother_country = sp.mother_country,
                s.mother_date_of_birth = sp.mother_date_of_birth,
                s.mother_job = sp.mother_job,
                s.mother_place_of_job = sp.mother_place_of_job,
                s.mother_condition = sp.mother_condition,
                s.mother_date_of_death = sp.mother_date_of_death,
                s.parents_relationship = sp.parents_relationship
        ');

        // Drop foreign key from student_profiles before dropping table
        Schema::table('student_profiles', function ($table) {
            $table->dropForeign(['student_id']);
        });

        // Drop student_profiles table
        Schema::dropIfExists('student_profiles');
    }

    public function down(): void
    {
        // Recreate student_profiles (data will be lost)
        Schema::create('student_profiles', function ($table) {
            $table->id();
            $table->foreignId('student_id')->constrained('students')->onDelete('cascade');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->string('postal_code')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('place_of_birth')->nullable();
            $table->string('gender')->nullable();
            $table->string('profile_picture')->nullable();
            $table->unsignedBigInteger('class_id')->nullable();
            $table->foreign('class_id')->references('id')->on('classes')->onDelete('set null');
            $table->string('admission_status')->nullable();
            $table->string('payment_proof')->nullable();
            $table->string('certificate_achievement')->nullable();
            $table->string('academic_transcript')->nullable();
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
            $table->string('father_condition')->nullable();
            $table->date('father_date_of_death')->nullable();
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
            $table->string('mother_condition')->nullable();
            $table->date('mother_date_of_death')->nullable();
            $table->string('parents_relationship')->nullable();
            $table->timestamps();
        });
    }
};
