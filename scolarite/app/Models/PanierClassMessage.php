<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PanierClassMessage extends Model
{
    protected $fillable = [
        'thread_id',
        'sender_user_id',
        'body',
        'image_path',
        'audio_path',
    ];

    public function thread(): BelongsTo
    {
        return $this->belongsTo(PanierClassMessageThread::class, 'thread_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function reads(): HasMany
    {
        return $this->hasMany(PanierClassMessageRead::class, 'panier_class_message_id');
    }
}
