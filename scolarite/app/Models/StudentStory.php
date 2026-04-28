<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentStory extends Model
{
    use HasFactory;

    protected $fillable = [
        'student_id',
        'body',
        'image_path',
        'overlay_style',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'overlay_style' => 'array',
    ];
}
