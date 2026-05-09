<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentModuleEliminationState extends Model
{
    protected $table = 'student_module_elimination_states';

    protected $fillable = [
        'student_id',
        'module_id',
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

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }
}
