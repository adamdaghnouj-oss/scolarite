<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'class_id',
        'sender_student_id',
        'body',
        'image_path',
        'audio_path',
    ];

    public function classe(): BelongsTo
    {
        return $this->belongsTo(Classe::class, 'class_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'sender_student_id');
    }

    public function reads(): HasMany
    {
        return $this->hasMany(ClassMessageRead::class, 'class_message_id');
    }
}

