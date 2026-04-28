<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClasseModuleProfAssignment extends Model
{
    protected $table = 'classe_module_prof_assignments';

    protected $fillable = [
        'class_id',
        'module_id',
        'annee_scolaire',
        'professeur_cours_id',
        'professeur_tp_id',
    ];

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class, 'module_id');
    }

    public function professeurCours(): BelongsTo
    {
        return $this->belongsTo(Professeur::class, 'professeur_cours_id');
    }

    public function professeurTp(): BelongsTo
    {
        return $this->belongsTo(Professeur::class, 'professeur_tp_id');
    }
}
