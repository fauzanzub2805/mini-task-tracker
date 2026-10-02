<?php

namespace Database\Seeders;

use App\Models\Priority;
use Illuminate\Database\Seeder;

/**
 * Tabel master priorities: low 1, medium 2, high 3 (level dipakai untuk sort).
 * Idempotent.
 */
class PrioritySeeder extends Seeder
{
    public const LEVELS = [
        'low' => 1,
        'medium' => 2,
        'high' => 3,
    ];

    public function run(): void
    {
        foreach (self::LEVELS as $name => $level) {
            Priority::updateOrCreate(['name' => $name], ['level' => $level]);
        }
    }
}
