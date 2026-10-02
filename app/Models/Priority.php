<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['name', 'level'])]
class Priority extends Model
{
    /** Tabel hanya punya created_at (tanpa updated_at). Diisi lewat seeder. */
    public const UPDATED_AT = null;

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }
}
