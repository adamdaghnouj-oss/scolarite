<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FriendInvitation extends Model
{
    use HasFactory;

    protected $fillable = [
        'sender_student_id',
        'receiver_student_id',
        'status',
        'accepted_at',
        'sender_seen_at',
    ];

    protected $casts = [
        'accepted_at' => 'datetime',
        'sender_seen_at' => 'datetime',
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
