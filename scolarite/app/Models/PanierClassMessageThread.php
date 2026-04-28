<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PanierClassMessageThread extends Model
{
    protected $fillable = [
        'class_id',
        'panier_id',
        'annee_scolaire',
    ];

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function panier(): BelongsTo
    {
        return $this->belongsTo(Panier::class, 'panier_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(PanierClassMessage::class, 'thread_id');
    }
}
