<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    /** Root sekarang mengarahkan ke halaman login frontend. */
    public function test_root_redirects_to_login_page(): void
    {
        $this->get('/')->assertRedirect('/login');
    }
}
