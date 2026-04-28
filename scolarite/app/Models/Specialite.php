<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Specialite extends Model
{
    use HasFactory;

    protected $fillable = [
        'departement',
        'code',
        'name',
    ];

    public function plansEtude(): HasMany
    {
        return $this->hasMany(PlanEtude::class);
    }
}

