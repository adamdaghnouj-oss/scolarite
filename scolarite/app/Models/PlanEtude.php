<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlanEtude extends Model
{
    use HasFactory;

    protected $table = 'plans_etude';

    protected $fillable = [
        'specialite_id',
        'semestre_id',
        'title',
        'version',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function specialite(): BelongsTo
    {
        return $this->belongsTo(Specialite::class);
    }

    public function semestre(): BelongsTo
    {
        return $this->belongsTo(Semestre::class);
    }

    public function paniers(): HasMany
    {
        return $this->hasMany(Panier::class);
    }

    public function affectations(): HasMany
    {
        return $this->hasMany(ClassePlanAffectation::class, 'plan_etude_id');
    }
}

