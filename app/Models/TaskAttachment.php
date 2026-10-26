<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Lampiran file task pada disk privat. */
#[Fillable(['task_id', 'uploaded_by_id', 'name', 'path', 'mime_type', 'size'])]
class TaskAttachment extends Model
{
    /** Tabel hanya punya created_at (tanpa updated_at). */
    public const UPDATED_AT = null;

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_id');
    }
}
