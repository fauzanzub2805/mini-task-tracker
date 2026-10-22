<?php

namespace Tests\Feature;

/**
 * Logout: sesi diinvalidasi, ID + token CSRF diputar, form HTML diarahkan ke
 * login, dan klien JSON tetap mendapat kontrak lama.
 */
class LogoutTest extends ApiTestCase
{
    public function test_json_logout_invalidates_session_and_rotates_id_and_token(): void
    {
        $user = $this->makeUser('staff');

        $this->actingAs($user)->getJson('/auth/me')->assertOk();

        $session = $this->app['session']->driver();
        $beforeId = $session->getId();
        $beforeToken = $session->token();

        $this->postJson('/auth/logout')
            ->assertOk()
            ->assertExactJson(['message' => 'Logout berhasil.']);

        $this->assertGuest();

        $afterId = $session->getId();
        $afterToken = $session->token();

        $this->assertNotSame($beforeId, $afterId, 'ID sesi harus diputar saat logout.');
        $this->assertNotSame($beforeToken, $afterToken, 'Token CSRF harus diputar saat logout.');

        // Sesi lama tidak boleh membuka route yang dilindungi.
        $this->getJson('/auth/me')->assertUnauthorized();
        $this->getJson('/projects')->assertUnauthorized();
    }

    public function test_html_logout_redirects_to_login_and_old_session_cannot_access_dashboard(): void
    {
        $this->withoutVite();
        $user = $this->makeUser('manager');

        $this->actingAs($user)->get('/dashboard')->assertOk();

        $session = $this->app['session']->driver();
        $beforeId = $session->getId();

        $this->post('/auth/logout')->assertRedirect('/login');
        $this->assertGuest();
        $this->assertNotSame($beforeId, $session->getId());

        $this->get('/dashboard')->assertRedirect('/login');
        $this->get('/login')->assertOk();
    }

    public function test_csrf_protection_rejects_missing_or_stale_token_and_accepts_fresh_token(): void
    {
        $this->withoutVite();
        $user = $this->makeUser('admin');

        $this->actingAs($user)->get('/dashboard')->assertOk();
        $session = $this->app['session']->driver();
        $token = $session->token();

        // Paksa middleware CSRF aktif (default-nya dilewati saat unit test).
        $previousEnv = $this->app['env'];
        $this->app['env'] = 'local';

        try {
            $this->post('/auth/logout')->assertStatus(419);
            $this->post('/auth/logout', ['_token' => 'token-lama'])->assertStatus(419);
            $this->assertAuthenticatedAs($user);

            $this->post('/auth/logout', ['_token' => $token])->assertRedirect('/login');
            $this->assertGuest();

            // Token lama tidak berlaku lagi setelah rotasi.
            $this->post('/auth/logout', ['_token' => $token])->assertStatus(419);
        } finally {
            $this->app['env'] = $previousEnv;
        }
    }
}
