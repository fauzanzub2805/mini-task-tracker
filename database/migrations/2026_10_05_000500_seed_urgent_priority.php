<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Prioritas "urgent" (level 4) ditambahkan setelah desain awal.
 * Idempotent: aman dijalankan pada database yang sudah punya baris urgent.
 */
return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::table('priorities')->where('name', 'urgent')->exists();
        if ($exists) {
            DB::table('priorities')->where('name', 'urgent')->update(['level' => 4]);

            return;
        }

        DB::table('priorities')->insert([
            'name' => 'urgent',
            'level' => 4,
            'created_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('priorities')->where('name', 'urgent')->delete();
    }
};
