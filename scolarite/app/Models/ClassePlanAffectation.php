<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassePlanAffectation extends Model
{
    use HasFactory;

    protected $fillable = [
        'class_id',
        'plan_etude_id',
        'annee_scolaire',
        'created_by',
    ];

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function planEtude(): BelongsTo
    {
        return $this->belongsTo(PlanEtude::class, 'plan_etude_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}

