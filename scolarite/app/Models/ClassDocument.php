<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'class_id',
        'semestre_id',
        'annee_scolaire',
        'title',
        'file_path',
        'file_mime',
        'file_size',
        'starts_at',
        'ends_at',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function semestre(): BelongsTo
    {
        return $this->belongsTo(Semestre::class, 'semestre_id');
    }
}

