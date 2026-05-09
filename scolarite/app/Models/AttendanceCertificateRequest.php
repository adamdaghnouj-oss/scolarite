<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceCertificateRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'professeur1_id',
        'professeur2_id',
        'language',
        'copies',
        'status',
        'accepted_by_professeur_id',
        'accepted_at',
        'rejected_at',
    ];

    protected $casts = [
        'accepted_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function professeur1(): BelongsTo
    {
        return $this->belongsTo(Professeur::class, 'professeur1_id');
    }

    public function professeur2(): BelongsTo
    {
        return $this->belongsTo(Professeur::class, 'professeur2_id');
    }

    public function acceptedByProfesseur(): BelongsTo
    {
        return $this->belongsTo(Professeur::class, 'accepted_by_professeur_id');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(AttendanceCertificateApproval::class, 'attendance_certificate_request_id');
    }
}

