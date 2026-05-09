<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceCertificateApproval extends Model
{
    use HasFactory;

    protected $fillable = [
        'attendance_certificate_request_id',
        'professeur_id',
        'decision',
        'decided_at',
        'note',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(AttendanceCertificateRequest::class, 'attendance_certificate_request_id');
    }

    public function professeur(): BelongsTo
    {
        return $this->belongsTo(Professeur::class);
    }
}

