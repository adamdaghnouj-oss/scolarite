<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ModuleStudentNote extends Model
{
    protected $table = 'module_student_notes';

    protected $fillable = [
        'module_id',
        'class_id',
        'annee_scolaire',
        'student_id',
        'professeur_id',
        'note',
    ];

    protected $casts = [
        'note' => 'decimal:2',
    ];

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
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
