<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class Classe extends Model
{
    use HasFactory;

    protected $table = 'classes';

    protected $fillable = [
        'name',
        'departement',
        'annee_scolaire',
    ];

    public function students(): HasMany
    {
        return $this->hasMany(Student::class, 'class_id');
    }

    /** Distinct department labels from classes (excludes year placeholder rows). */
    public static function distinctDepartementNames(): Collection
    {
        return static::query()
            ->whereNotNull('departement')
            ->where('departement', '!=', '')
            ->where('departement', '!=', '__YEAR__')
            ->distinct()
            ->orderBy('departement')
            ->pluck('departement')
            ->values();
    }
}
