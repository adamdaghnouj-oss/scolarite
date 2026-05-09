<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DoubleCorrectionRequest extends Model
{
    protected $fillable = [
        'student_id',
        'class_id',
        'annee_scolaire',
        'panier_id',
        'professeur_id',
        'status',
        'reason',
        'decision_note',
        'decided_at',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function panier(): BelongsTo
    {
        return $this->belongsTo(Panier::class, 'panier_id');
    }

    public function professeur(): BelongsTo
    {
        return $this->belongsTo(Professeur::class, 'professeur_id');
    }
}

