<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Permission\Models\Role;

#[Fillable(['project_id', 'user_id', 'role_id'])]
class ProjectMember extends Model
{
    /** Tabel hanya punya joined_at (tanpa updated_at). */
    public const CREATED_AT = 'joined_at';
    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'joined_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Peran di dalam project ini; boleh berbeda dari peran global. */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }
}
