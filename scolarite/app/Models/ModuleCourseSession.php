<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ModuleCourseSession extends Model
{
    protected $table = 'module_course_sessions';

    protected $fillable = [
        'panier_id',
        'module_id',
        'class_id',
        'annee_scolaire',
        'professeur_id',
        'session_date',
        'time_start',
        'time_end',
    ];

    protected $casts = [
        'session_date' => 'date',
    ];

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    public function panier(): BelongsTo
    {
        return $this->belongsTo(Panier::class);
    }

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function professeur(): BelongsTo
    {
        return $this->belongsTo(Professeur::class);
    }

    public function attendance(): HasMany
    {
        return $this->hasMany(ModuleSessionAttendance::class, 'module_course_session_id');
    }
}
