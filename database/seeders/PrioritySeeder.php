<?php

namespace Database\Seeders;

use App\Models\Priority;
use Illuminate\Database\Seeder;

/**
 * Tabel master priorities: low 1, medium 2, high 3, urgent 4 (level dipakai
 * untuk sort). Urgent ditambahkan mengikuti desain UI terbaru. Idempotent.
 */
class PrioritySeeder extends Seeder
{
    public const LEVELS = [
        'low' => 1,
        'medium' => 2,
        'high' => 3,
        'urgent' => 4,
    ];

    public function run(): void
    {
        foreach (self::LEVELS as $name => $level) {
            Priority::updateOrCreate(['name' => $name], ['level' => $level]);
        }
    }
}
