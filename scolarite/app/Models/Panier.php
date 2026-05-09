<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Panier extends Model
{
    use HasFactory;

    protected $fillable = [
        'plan_etude_id',
        'name',
        'ordre',
    ];

    public function planEtude(): BelongsTo
    {
        return $this->belongsTo(PlanEtude::class, 'plan_etude_id');
    }

    public function modules(): HasMany
    {
        return $this->hasMany(Module::class);
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(Evaluation::class);
    }
}

