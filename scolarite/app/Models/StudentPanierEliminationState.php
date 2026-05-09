<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentPanierEliminationState extends Model
{
    protected $table = 'student_panier_elimination_states';

    protected $fillable = [
        'student_id',
        'panier_id',
        'class_id',
        'annee_scolaire',
        'dismissed_by_prof',
    ];

    protected $casts = [
        'dismissed_by_prof' => 'boolean',
    ];

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function panier(): BelongsTo
    {
        return $this->belongsTo(Panier::class);
    }

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }
}
