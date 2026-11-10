<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Foto task: gambar tersendiri yang ditambahkan saat membuat task. Terpisah
 * dari lampiran (Instructions/Submitted/Given Files) dan dipakai sebagai
 * gambar task pada halaman "My Tasks". Mengikuti pola projects.image_path.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('due_date');
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });
    }
};
