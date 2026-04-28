<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Professeur extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'matricule',
        'departement',
        'phone',
        'address',
        'postal_code',
        'city',
        'country',
        'date_of_birth',
        'place_of_birth',
        'gender',
        'profile_picture',
        'cover_photo',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
