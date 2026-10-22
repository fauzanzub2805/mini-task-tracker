<?php

namespace Tests\Feature;

use App\Models\User;

class ProfilePageTest extends ApiTestCase
{
    public function test_guests_are_redirected_to_login(): void
    {
        $this->get('/profile')->assertRedirect('/login');
        $this->get('/profile/messages')->assertRedirect('/login');
    }

    public function test_profile_page_renders_for_authenticated_user(): void
    {
        $this->withoutVite();
        $user = $this->makeUser('manager');
        // Nama deterministik (tanpa apostrof) agar tidak bergantung pada
        // escaping @json untuk nama acak dari factory.
        $user->forceFill(['name' => 'Andi Wijaya'])->save();

        $response = $this->actingAs($user)->get('/profile');

        $response->assertOk()
            ->assertViewIs('dashboard')
            ->assertSee('Profile · Rekayasa Task Tracker')
            ->assertSee('data-dashboard', false)
            ->assertSee('Andi Wijaya')
            ->assertSee('"page":"profile"', false);
    }

    public function test_message_page_renders_with_messages_page_and_authenticated_identity(): void
    {
        $this->withoutVite();
        $user = $this->makeUser('staff');
        $user->forceFill(['name' => 'Siti Rahma'])->save();

        $response = $this->actingAs($user)->get('/profile/messages');

        $response->assertOk()
            ->assertViewIs('dashboard')
            ->assertSee('Message · Rekayasa Task Tracker')
            ->assertSee('data-dashboard', false)
            ->assertSee('Siti Rahma')
            ->assertSee('"page":"messages"', false)
            ->assertSee('"id":'.$user->id, false);
    }
}
