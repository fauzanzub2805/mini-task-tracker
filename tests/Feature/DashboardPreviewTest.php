<?php

namespace Tests\Feature;

use Tests\TestCase;

class DashboardPreviewTest extends TestCase
{
    public function test_guest_dashboard_redirects_to_login_but_api_remains_json(): void
    {
        $this->get('/dashboard')->assertRedirect('/login');
        $this->getJson('/dashboard')->assertUnauthorized();
        $this->get('/auth/me')->assertUnauthorized();
    }

    public function test_authenticated_dashboard_renders(): void
    {
        $this->withoutVite();
        $user = new \App\Models\User();
        $user->id = 1;
        $this->actingAs($user)->get('/dashboard')->assertOk()->assertViewIs('dashboard');
    }

    public function test_dashboard_preview_serves_react_host_without_real_user_data(): void
    {
        $this->withoutVite();
        $this->get('/dashboard/preview')
            ->assertOk()
            ->assertViewIs('dashboard')
            ->assertSee('Dashboard Preview')
            ->assertSee('id="dashboard-app"', false)
            ->assertDontSee('data-login-app', false);
    }
}
