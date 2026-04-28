<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentPostComment extends Model
{
    use HasFactory;

    protected $fillable = [
        'post_id',
        'author_user_id',
        'body',
    ];

    public function authorUser(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
