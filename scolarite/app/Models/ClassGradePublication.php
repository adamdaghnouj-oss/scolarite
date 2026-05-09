<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassGradePublication extends Model
{
    protected $fillable = [
        'class_id',
        'annee_scolaire',
        'published_at',
        'published_by',
    ];

    protected $casts = [
        'published_at' => 'datetime',
    ];

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }
}
