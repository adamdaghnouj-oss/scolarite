<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PanierStudentEvaluationGrade extends Model
{
    protected $table = 'panier_student_evaluation_grades';

    protected $fillable = [
        'panier_id',
        'class_id',
        'annee_scolaire',
        'student_id',
        'evaluation_type',
        'note',
        'professeur_id',
    ];

    protected $casts = [
        'note' => 'decimal:2',
    ];

    public function panier(): BelongsTo
    {
        return $this->belongsTo(Panier::class);
    }

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function professeur(): BelongsTo
    {
        return $this->belongsTo(Professeur::class);
    }
}
