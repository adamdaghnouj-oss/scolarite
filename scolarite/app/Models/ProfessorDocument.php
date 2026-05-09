<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProfessorDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
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
}

