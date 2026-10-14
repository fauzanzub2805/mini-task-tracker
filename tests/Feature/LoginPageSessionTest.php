<?php

namespace Tests\Feature;

/**
 * Perilaku halaman login terhadap sesi (butuh database, seperti tes API lain).
 */
class LoginPageSessionTest extends ApiTestCase
{
    public function test_reload_with_active_session_shows_success_panel(): void
    {
        $this->withoutVite();
        $user = $this->makeUser('manager');

        $this->actingAs($user)->get('/login')
            ->assertOk()
            ->assertViewHas('currentUser', fn ($current) => $current['email'] === $user->email
                && $current['roles'] === ['manager'])
            ->assertSee($user->name);
    }

    public function test_json_login_contract_unchanged(): void
    {
        $user = $this->makeUser('staff');

        $this->postJson('/auth/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['id', 'name', 'email', 'roles']]);
    }
}
