<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Data referensi (role, permission, priority) selalu di-seed.
     * Data demo (user, project, task, dst.) otomatis dilewati di production.
     */
    public function run(): void
    {
        $this->call([
            RolesAndPermissionsSeeder::class,
            PrioritySeeder::class,
            DemoDataSeeder::class,
        ]);
    }
}
