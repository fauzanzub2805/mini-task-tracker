<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['project_id', 'title', 'description', 'status', 'priority_id', 'due_date', 'assignee_id', 'created_by_id'])]
class Task extends Model
{
    public const STATUS_TODO = 'todo';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_FINISH_DEV = 'finish_dev';
    public const STATUS_TESTING = 'testing';
    public const STATUS_DONE = 'done';

    /** Urutan mengikuti pilihan di UI (STATUS_OPTIONS pada projectsApi.js). */
    public const STATUSES = [
        self::STATUS_TODO,
        self::STATUS_IN_PROGRESS,
        self::STATUS_FINISH_DEV,
        self::STATUS_TESTING,
        self::STATUS_DONE,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'due_date' => 'date',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function priority(): BelongsTo
    {
        return $this->belongsTo(Priority::class);
    }

    /** Assignee utama (kolom lama, tetap dipertahankan untuk kompatibilitas API). */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    /** Semua assignee task (relasi banyak-ke-banyak). */
    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_assignees')->withPivot('created_at');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskAttachment::class)->orderBy('id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(Activity::class);
    }

    /**
     * Sinkronkan daftar assignee sekaligus menjaga assignee_id (assignee utama)
     * agar tetap terisi untuk klien lama.
     *
     * @param  array<int, int|string>  $userIds
     */
    public function syncAssignees(array $userIds): void
    {
        $ids = array_values(array_unique(array_map('intval', $userIds)));

        $this->assignees()->sync($ids);
        $this->assignee_id = $ids[0] ?? null;
        $this->save();
    }

    /** @return array<int, int> */
    public function assigneeIds(): array
    {
        if ($this->relationLoaded('assignees')) {
            return $this->assignees->pluck('id')->map(fn ($id) => (int) $id)->all();
        }

        return $this->assignees()->pluck('users.id')->map(fn ($id) => (int) $id)->all();
    }

    /** Filter daftar task berdasarkan salah satu assignee di pivot. */
    public function scopeAssignedTo(Builder $query, int $userId): Builder
    {
        return $query->where(function (Builder $q) use ($userId) {
            $q->where('tasks.assignee_id', $userId)
                ->orWhereHas('assignees', fn (Builder $inner) => $inner->where('users.id', $userId));
        });
    }
}
