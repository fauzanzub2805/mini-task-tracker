<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * Tes render halaman login. Tidak membutuhkan database
 * (tamu tidak memicu query user).
 */
class LoginPageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Hindari ketergantungan pada hasil `npm run build` saat tes.
        $this->withoutVite();
    }

    public function test_login_route_is_named_and_renders_html(): void
    {
        $this->assertSame(url('/login'), route('login'));

        $this->get('/login')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
            ->assertViewIs('auth.login')
            ->assertViewHas('currentUser', null)
            ->assertSee('<html lang="id"', false)
            ->assertSee('name="csrf-token"', false)
            ->assertSee('id="login-app"', false)
            ->assertSee('data-login-app=', false)
            ->assertDontSee('x-data=', false)
            ->assertDontSee('<form', false);
    }

    public function test_react_bootstrap_is_safe_and_preserves_old_email(): void
    {
        $email = "a'\"><script>alert(1)</script>@example.com";
        $response = $this->withSession(['_old_input' => ['email' => $email]])->get('/login');
        $response->assertOk()->assertDontSee('<script>alert(1)</script>', false);
        preg_match("/data-login-app='([^']*)'/", $response->getContent(), $matches);
        $options = json_decode($matches[1], true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame($email, $options['oldEmail']);
        $this->assertNull($options['user']);
        $this->assertNotEmpty($options['csrfToken']);
        $this->assertArrayNotHasKey('password', $options);
    }

    public function test_login_page_has_no_signup_or_remember_me(): void
    {
        $this->get('/login')
            ->assertDontSee('name="remember"', false)
            ->assertDontSee('href="/register"', false)
            ->assertDontSee('/auth/register', false);
    }

    public function test_guest_api_still_returns_json_401(): void
    {
        $this->get('/auth/me')->assertUnauthorized()->assertJson(['message' => 'Unauthenticated.']);
        $this->getJson('/auth/me')->assertUnauthorized();
    }

    public function test_unknown_page_still_renders_json_404(): void
    {
        $this->get('/tidak-ada')->assertNotFound()->assertHeader('Content-Type', 'application/json');
    }
}
