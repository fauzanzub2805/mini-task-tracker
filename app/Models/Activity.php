<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

#[Fillable(['project_id', 'task_id', 'user_id', 'action', 'description'])]
class Activity extends Model
{
    /** Tabel hanya punya created_at (tanpa updated_at). */
    public const UPDATED_AT = null;

    /** Hanya-tambah: tidak boleh diubah atau dihapus lewat model. */
    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Activity bersifat hanya-tambah.'));
        static::deleting(fn () => throw new LogicException('Activity bersifat hanya-tambah.'));
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    /** Pelaku. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
