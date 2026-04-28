<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StudentStoryLike extends Model
{
    use HasFactory;

    protected $fillable = [
        'story_id',
        'student_id',
    ];
}
