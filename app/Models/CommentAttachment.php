<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Lampiran komentar pada disk privat; akses lewat endpoint unduh ber-otorisasi. */
#[Fillable(['comment_id', 'uploaded_by_id', 'name', 'path', 'mime_type', 'size'])]
class CommentAttachment extends Model
{
    /** Tabel hanya punya created_at (tanpa updated_at). */
    public const UPDATED_AT = null;

    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }
}
