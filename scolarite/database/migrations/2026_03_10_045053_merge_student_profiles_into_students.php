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

        // Copy data from student_profiles to students using portable queries.
        DB::table('student_profiles')
            ->orderBy('id')
            ->chunkById(100, function ($profiles) {
                foreach ($profiles as $profile) {
                    DB::table('students')
                        ->where('id', $profile->student_id)
                        ->update([
                            'phone' => $profile->phone,
                            'address' => $profile->address,
                            'postal_code' => $profile->postal_code,
                            'city' => $profile->city,
                            'country' => $profile->country,
                            'date_of_birth' => $profile->date_of_birth,
                            'place_of_birth' => $profile->place_of_birth,
                            'gender' => $profile->gender,
                            'profile_picture' => $profile->profile_picture,
                            'admission_status' => $profile->admission_status,
                            'payment_proof' => $profile->payment_proof,
                            'certificate_achievement' => $profile->certificate_achievement,
                            'academic_transcript' => $profile->academic_transcript,
                            'father_first_name' => $profile->father_first_name,
                            'father_last_name' => $profile->father_last_name,
                            'father_phone' => $profile->father_phone,
                            'father_email' => $profile->father_email,
                            'father_address' => $profile->father_address,
                            'father_postal_code' => $profile->father_postal_code,
                            'father_city' => $profile->father_city,
                            'father_country' => $profile->father_country,
                            'father_date_of_birth' => $profile->father_date_of_birth,
                            'father_job' => $profile->father_job,
                            'father_place_of_job' => $profile->father_place_of_job,
                            'father_condition' => $profile->father_condition,
                            'father_date_of_death' => $profile->father_date_of_death,
                            'mother_first_name' => $profile->mother_first_name,
                            'mother_last_name' => $profile->mother_last_name,
                            'mother_phone' => $profile->mother_phone,
                            'mother_email' => $profile->mother_email,
                            'mother_address' => $profile->mother_address,
                            'mother_postal_code' => $profile->mother_postal_code,
                            'mother_city' => $profile->mother_city,
                            'mother_country' => $profile->mother_country,
                            'mother_date_of_birth' => $profile->mother_date_of_birth,
                            'mother_job' => $profile->mother_job,
                            'mother_place_of_job' => $profile->mother_place_of_job,
                            'mother_condition' => $profile->mother_condition,
                            'mother_date_of_death' => $profile->mother_date_of_death,
                            'parents_relationship' => $profile->parents_relationship,
                        ]);
                }
            });

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
