<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Lampiran file task pada disk privat. */
#[Fillable(['task_id', 'uploaded_by_id', 'kind', 'name', 'path', 'mime_type', 'size'])]
class TaskAttachment extends Model
{
    /** Berkas instruksi dari manager (Instructions File / Given Files). */
    public const KIND_INSTRUCTION = 'instruction';

    /** Berkas hasil kumpulan pengguna (Submitted Files). */
    public const KIND_SUBMISSION = 'submission';

    public const KINDS = [self::KIND_INSTRUCTION, self::KIND_SUBMISSION];

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
