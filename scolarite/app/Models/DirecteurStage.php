<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DirecteurStage extends Model
{
    use HasFactory;

    protected $table = 'directeurs_stage';

    protected $fillable = [
        'user_id',
        'matricule',
        'departement',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
