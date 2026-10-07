<?php

namespace Database\Factories;

use App\Models\Invitation;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Role;

/**
 * @extends Factory<Invitation>
 */
class InvitationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'email' => fake()->unique()->safeEmail(),
            'token' => Str::random(64),
            'invited_by_id' => null,
            'role_id' => fn () => Role::findOrCreate('staff', 'web')->id,
            'status' => Invitation::STATUS_PENDING,
            'expires_at' => now()->addDays(7),
            'accepted_at' => null,
        ];
    }

    public function accepted(): static
    {
        return $this->state(fn () => [
            'status' => Invitation::STATUS_ACCEPTED,
            'accepted_at' => now(),
        ]);
    }

    public function revoked(): static
    {
        return $this->state(fn () => [
            'status' => Invitation::STATUS_REVOKED,
        ]);
    }

    public function expired(): static
    {
        return $this->state(fn () => [
            'expires_at' => now()->subDay(),
        ]);
    }
}
