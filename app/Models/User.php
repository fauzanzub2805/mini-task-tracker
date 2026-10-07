<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password_hash'])]
#[Hidden(['password_hash'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable;

    /**
     * Kolom password di ERD bernama password_hash (bukan password).
     * Input form tetap boleh bernama "password".
     */
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    public function getAuthPasswordName(): string
    {
        return 'password_hash';
    }

    /**
     * ERD tidak punya kolom remember_token: fitur "remember me" dimatikan.
     */
    public function getRememberTokenName(): string
    {
        return '';
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password_hash' => 'hashed',
        ];
    }

    public function invitation(): BelongsTo
    {
        // Tidak ada FK: undangan dicocokkan lewat email.
        return $this->belongsTo(Invitation::class, 'email', 'email');
    }

    /** Peran user di sebuah project, atau null bila bukan anggota. */
    public function roleInProject(Project|int $project): ?Role
    {
        $projectId = $project instanceof Project ? $project->id : $project;

        return ProjectMember::query()
            ->where('project_id', $projectId)
            ->where('user_id', $this->id)
            ->first()
            ?->role;
    }

    /** Lapis 1 + 2: izin diambil dari peran user di project tersebut. */
    public function canInProject(string $permission, Project|int $project): bool
    {
        return $this->roleInProject($project)?->hasPermissionTo($permission) ?? false;
    }

    public function createdProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'created_by_id');
    }

    /** Project yang diikuti user (lapis 2 otorisasi). */
    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_members')
            ->withPivot(['role_id', 'joined_at']);
    }

    public function assignedTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assignee_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class, 'author_id');
    }
}
