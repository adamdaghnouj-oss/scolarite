<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InternshipRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'class_id',
        'teammate_student_id',
        'approved_by_directeur_stage_id',
        'internship_type',
        'company_name',
        'project_name',
        'project_description',
        'start_date',
        'end_date',
        'status',
        'director_comment',
        'deadline_rapport',
        'deadline_attestation',
        'signed_demande_path',
        'rapport_path',
        'attestation_path',
        'rapport_status',
        'attestation_status',
        'rapport_review_comment',
        'attestation_review_comment',
        'rapport_reviewed_at',
        'attestation_reviewed_at',
        'signed_demande_uploaded_at',
        'approved_at',
        'rejected_at',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'deadline_rapport' => 'date',
        'deadline_attestation' => 'date',
        'rapport_reviewed_at' => 'datetime',
        'attestation_reviewed_at' => 'datetime',
        'signed_demande_uploaded_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function teammateStudent(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'teammate_student_id');
    }

    public function approvedByDirecteurStage(): BelongsTo
    {
        return $this->belongsTo(DirecteurStage::class, 'approved_by_directeur_stage_id');
    }
}
