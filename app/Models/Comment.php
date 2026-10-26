<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['task_id', 'author_id', 'body'])]
class Comment extends Model
{
    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /** Anggota project yang di-mention di komentar ini. */
    public function mentions(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'comment_mentions')->withPivot('created_at');
    }

    /** File yang diunggah bersama komentar ini (disk privat). */
    public function attachments(): HasMany
    {
        return $this->hasMany(CommentAttachment::class)->orderBy('id');
    }
}
