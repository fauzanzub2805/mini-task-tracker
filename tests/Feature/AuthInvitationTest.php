<?php

namespace Tests\Feature;

use App\Models\Invitation;
use App\Models\User;
use Database\Seeders\AdminSeeder;
use Illuminate\Support\Facades\Mail;
use Spatie\Permission\Models\Role;

class AuthInvitationTest extends ApiTestCase
{
    private function invite(string $email = 'baru@example.com', string $status = 'pending', ?\DateTimeInterface $exp = null): Invitation
    {
        return Invitation::create([
            'email' => $email, 'token' => bin2hex(random_bytes(32)),
            'role_id' => Role::findByName('staff', 'web')->id,
            'status' => $status, 'expires_at' => $exp ?? now()->addDay(),
        ]);
    }

    public function test_register_with_valid_token_creates_user_with_email_and_role_from_invitation(): void
    {
        $inv = $this->invite();

        $this->postJson('/auth/register', [
            'token' => $inv->token, 'name' => 'Baru', 'password' => 'rahasia123',
            'email' => 'penyusup@example.com',
        ])->assertCreated()->assertJsonPath('data.email', 'baru@example.com');

        $user = User::where('email', 'baru@example.com')->firstOrFail();
        $this->assertTrue($user->hasRole('staff'));
        $this->assertDatabaseMissing('users', ['email' => 'penyusup@example.com']);
        $this->assertSame('accepted', $inv->fresh()->status);
        $this->assertNotNull($inv->fresh()->accepted_at);
        $this->assertAuthenticatedAs($user);
    }

    public function test_invitation_token_expires_after_10_minutes(): void
    {
        Mail::fake();
        $this->actingAs($this->makeUser('admin'))->postJson('/invitations', [
            'email' => 'cepat@example.com', 'role_id' => Role::findByName('staff', 'web')->id,
        ])->assertCreated();

        $inv = Invitation::where('email', 'cepat@example.com')->firstOrFail();
        $this->assertEqualsWithDelta(10 * 60, now()->diffInSeconds($inv->expires_at, true), 5);

        $this->travel(9)->minutes();
        $this->getJson('/invitations/'.$inv->token)->assertOk();

        $this->travel(2)->minutes();
        $this->getJson('/invitations/'.$inv->token)->assertUnprocessable();
        $this->postJson('/auth/register', ['token' => $inv->token, 'name' => 'Telat', 'password' => 'rahasia123'])
            ->assertUnprocessable();
        $this->assertDatabaseMissing('users', ['email' => 'cepat@example.com']);
    }

    public function test_register_rejects_used_revoked_expired_and_unknown_tokens(): void
    {
        $cases = [
            $this->invite('a@example.com', 'accepted')->token,
            $this->invite('b@example.com', 'revoked')->token,
            $this->invite('c@example.com', 'pending', now()->subDay())->token,
            'tidak-ada',
        ];

        foreach ($cases as $token) {
            $this->postJson('/auth/register', ['token' => $token, 'name' => 'X', 'password' => 'rahasia123'])
                ->assertUnprocessable();
        }
        $this->assertSame(0, User::count());
    }

    public function test_same_token_cannot_be_redeemed_twice(): void
    {
        $inv = $this->invite();
        $payload = ['token' => $inv->token, 'name' => 'A', 'password' => 'rahasia123'];

        $this->postJson('/auth/register', $payload)->assertCreated();
        $this->app['auth']->forgetGuards();
        $this->postJson('/auth/register', $payload)->assertUnprocessable();

        $this->assertSame(1, User::count());
    }

    public function test_login_me_and_logout(): void
    {
        $user = $this->makeUser('manager');

        $this->postJson('/auth/login', ['email' => $user->email, 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/auth/login', ['email' => strtoupper($user->email), 'password' => 'password'])
            ->assertOk()->assertJsonPath('data.roles.0', 'manager');
        $this->getJson('/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
        $this->postJson('/auth/logout')->assertOk();
        $this->assertGuest();
    }

    public function test_guest_gets_401_on_protected_routes(): void
    {
        $this->getJson('/auth/me')->assertUnauthorized();
        $this->getJson('/projects')->assertUnauthorized();
        $this->get('/projects')->assertUnauthorized();
    }

    public function test_only_admin_can_create_list_and_revoke_invitations(): void
    {
        Mail::fake();
        $staffRole = Role::findByName('staff', 'web');

        $this->actingAs($this->makeUser('manager'))
            ->postJson('/invitations', ['email' => 'x@example.com', 'role_id' => $staffRole->id])->assertForbidden();
        $this->getJson('/invitations')->assertForbidden();

        $admin = $this->makeUser('admin');
        $res = $this->actingAs($admin)
            ->postJson('/invitations', ['email' => ' X@Example.com ', 'role_id' => $staffRole->id])
            ->assertCreated()->assertJsonPath('data.email', 'x@example.com')->assertJsonMissingPath('data.token');

        $inv = Invitation::where('email', 'x@example.com')->firstOrFail();
        $this->assertSame(64, strlen($inv->token));
        $this->assertSame($admin->id, $inv->invited_by_id);

        $this->getJson('/invitations?status=pending')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/invitations?status=revoked')->assertOk()->assertJsonCount(0, 'data');

        $this->deleteJson('/invitations/'.$res->json('data.id'))->assertOk()->assertJsonPath('data.status', 'revoked');
        $this->deleteJson('/invitations/'.$res->json('data.id'))->assertUnprocessable();
    }

    public function test_cannot_invite_registered_email_or_revoke_accepted_invitation(): void
    {
        Mail::fake();
        $admin = $this->makeUser('admin');
        $staffRole = Role::findByName('staff', 'web');
        $existing = $this->makeUser('staff');

        $this->actingAs($admin)->postJson('/invitations', ['email' => $existing->email, 'role_id' => $staffRole->id])
            ->assertUnprocessable();

        $accepted = $this->invite('ok@example.com', 'accepted');
        $this->deleteJson('/invitations/'.$accepted->id)->assertUnprocessable();
    }

    public function test_show_token_is_public_and_validates(): void
    {
        $inv = $this->invite();
        $this->getJson('/invitations/'.$inv->token)->assertOk()->assertJsonPath('data.email', 'baru@example.com');
        $this->getJson('/invitations/nope')->assertNotFound();

        $inv->update(['status' => 'revoked']);
        $this->getJson('/invitations/'.$inv->token)->assertUnprocessable();
    }

    public function test_admin_seeder_is_idempotent_and_reads_env_config(): void
    {
        config(['app.admin.email' => 'Boss@Example.com', 'app.admin.password' => 'rahasia123']);

        $this->seed(AdminSeeder::class);
        $this->seed(AdminSeeder::class);

        $this->assertSame(1, User::where('email', 'boss@example.com')->count());
        $this->assertTrue(User::where('email', 'boss@example.com')->first()->hasRole('admin'));
    }
}
