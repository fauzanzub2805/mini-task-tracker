<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'sender_id',
    'recipient_id',
    'body',
    'attachment_path',
    'attachment_name',
    'attachment_mime',
    'attachment_size',
    'read_at',
])]
class DirectMessage extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'attachment_size' => 'integer',
            'read_at' => 'datetime',
        ];
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    public function hasAttachment(): bool
    {
        return $this->attachment_path !== null;
    }

    /** Pesan milik salah satu peserta percakapan. */
    public function isParticipant(int $userId): bool
    {
        return $this->sender_id === $userId || $this->recipient_id === $userId;
    }
}
