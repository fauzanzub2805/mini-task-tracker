<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'project_id', 'task_id', 'message_id', 'type', 'title', 'body', 'url', 'event_key', 'read_at'])]
class AppNotification extends Model
{
    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where('user_id', $user->id)->where(function (Builder $q) use ($user) {
            $q->whereNull('project_id')->orWhereHas('project', fn (Builder $p) => $p->visibleTo($user));
        });
    }
}
