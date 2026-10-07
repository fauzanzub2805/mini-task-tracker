<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Admin melewati seluruh pemeriksaan (lapis 2 tidak berlaku bagi Admin).
        Gate::before(fn (User $user) => $user->hasRole('admin') ? true : null);
    }
}
