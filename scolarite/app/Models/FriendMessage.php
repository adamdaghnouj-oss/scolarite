<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FriendMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'sender_student_id',
        'receiver_student_id',
        'body',
        'image_path',
        'audio_path',
        'pdf_path',
        'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function sender(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'sender_student_id');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'receiver_student_id');
    }
}
