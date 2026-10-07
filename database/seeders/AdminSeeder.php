<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

/**
 * Admin pertama (TSD 4.10): satu-satunya akun yang tidak lahir dari undangan.
 * Email dan password dari env (ADMIN_EMAIL, ADMIN_PASSWORD). Idempotent.
 */
class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('app.admin.email');
        $password = config('app.admin.password');

        if (! $email || ! $password) {
            $this->command?->warn('AdminSeeder dilewati: ADMIN_EMAIL / ADMIN_PASSWORD belum diisi.');

            return;
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $user = User::firstOrCreate(
            ['email' => mb_strtolower(trim($email))],
            ['name' => config('app.admin.name'), 'password_hash' => $password],
        );

        if (! $user->hasRole('admin')) {
            $user->assignRole('admin');
        }
    }
}
