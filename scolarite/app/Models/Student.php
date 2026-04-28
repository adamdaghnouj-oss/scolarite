<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Student extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'matricule',
        'classe',
        'class_id',
        // Personal info
        'phone',
        'address',
        'postal_code',
        'city',
        'country',
        'date_of_birth',
        'place_of_birth',
        'gender',
        'profile_picture',
        'cover_photo',
        // Personnel Info Status
        'personnel_info_status',
        'personnel_info_comment',
        // Academic
        'admission_status',
        // Academic Info Status
        'academic_info_status',
        'academic_info_comment',
        // Documents
        'payment_proof',
        'certificate_achievement',
        'academic_transcript',
        // Document Status
        'payment_proof_status',
        'payment_proof_comment',
        'certificate_status',
        'certificate_comment',
        'transcript_status',
        'transcript_comment',
        // Father
        'father_first_name',
        'father_last_name',
        'father_phone',
        'father_email',
        'father_address',
        'father_postal_code',
        'father_city',
        'father_country',
        'father_date_of_birth',
        'father_job',
        'father_place_of_job',
        'father_condition',
        'father_date_of_death',
        // Father Info Status
        'father_info_status',
        'father_info_comment',
        // Mother
        'mother_first_name',
        'mother_last_name',
        'mother_phone',
        'mother_email',
        'mother_address',
        'mother_postal_code',
        'mother_city',
        'mother_country',
        'mother_date_of_birth',
        'mother_job',
        'mother_place_of_job',
        'mother_condition',
        'mother_date_of_death',
        // Mother Info Status
        'mother_info_status',
        'mother_info_comment',
        // Parents relationship
        'parents_relationship',
        // Parents Relationship Status
        'parents_relationship_status',
        'parents_relationship_comment',
        // Overall status
        'personal_info_status',
        'personal_info_comment',
        'overall_status',
        // Profile approval status
        'status',
        'status_comment',
        'approved_at',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'father_date_of_birth' => 'date',
        'father_date_of_death' => 'date',
        'mother_date_of_birth' => 'date',
        'mother_date_of_death' => 'date',
        'approved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function classeObj(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }
}
