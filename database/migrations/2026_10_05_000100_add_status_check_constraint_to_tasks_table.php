<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Status task: todo | in_progress | finish_dev | testing | done.
 *
 * ERD awal hanya mengenal 3 status dan memvalidasinya di aplikasi. Desain UI
 * (STATUS/Screenshot 2026-10-26) menambah finish_dev dan testing, jadi
 * daftar nilai ditegakkan juga di database. CHECK constraint hanya dipasang
 * di PostgreSQL; SQLite (dipakai test suite) tidak mendukung ADD CONSTRAINT
 * sehingga validasi di Form Request tetap menjadi lapis penjaga di sana.
 */
return new class extends Migration
{
    public const STATUSES = ['todo', 'in_progress', 'finish_dev', 'testing', 'done'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check');
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in_progress', 'finish_dev', 'testing', 'done'))");
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check');
        DB::statement("ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'in_progress', 'done'))");
    }
};
