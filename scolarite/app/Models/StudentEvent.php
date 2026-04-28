<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StudentEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'author_user_id',
        'event_type',
        'title',
        'description',
        'place',
        'event_at',
        'image_path',
    ];

    protected $casts = [
        'event_at' => 'datetime',
    ];

    public function authorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
