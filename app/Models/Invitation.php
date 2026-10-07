<?php

namespace App\Models;

use Database\Factories\InvitationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Spatie\Permission\Models\Role;

#[Fillable(['email', 'token', 'invited_by_id', 'role_id', 'status', 'expires_at', 'accepted_at'])]
class Invitation extends Model
{
    /** @use HasFactory<InvitationFactory> */
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REVOKED = 'revoked';

    /** Tabel hanya punya created_at (tanpa updated_at). */
    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    /** Email selalu disimpan lowercase. */
    protected function email(): Attribute
    {
        return Attribute::make(set: fn (string $value) => mb_strtolower(trim($value)));
    }

    /** NULL hanya pada baris bootstrap. */
    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by_id');
    }

    /** Peran global yang diberikan saat token ditukarkan. */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function user(): HasOne
    {
        // Tanpa FK: undangan dan akun dihubungkan lewat email (TSD Revisi 5).
        return $this->hasOne(User::class, 'email', 'email');
    }

    /** Kedaluwarsa dihitung dari expires_at, bukan dari status. */
    public function isUsable(): bool
    {
        return $this->status === self::STATUS_PENDING && $this->expires_at->isFuture();
    }
}
