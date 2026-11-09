<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Membedakan dua peran lampiran task:
 *  - instruction : berkas instruksi dari Project Manager (dulu "Files",
 *    kini "Instructions File"). Tampil juga sebagai "Given Files" di
 *    halaman task milik pengguna.
 *  - submission  : berkas hasil kumpulan pengguna ("Submit File") yang
 *    muncul pada daftar "Submitted Files" beserta nama pengirimnya.
 *
 * Lampiran lama tidak punya kolom ini, jadi default-nya 'instruction' agar
 * perilaku lama tidak berubah. CHECK constraint hanya dipasang di PostgreSQL;
 * SQLite (dipakai test suite) tidak mendukung ADD CONSTRAINT sehingga daftar
 * nilai ditegakkan di Form Request / controller pada lingkungan itu.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('task_attachments', function (Blueprint $table) {
            $table->string('kind', 16)->default('instruction')->after('uploaded_by_id');
            $table->index(['task_id', 'kind']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE task_attachments DROP CONSTRAINT IF EXISTS task_attachments_kind_check');
            DB::statement("ALTER TABLE task_attachments ADD CONSTRAINT task_attachments_kind_check CHECK (kind IN ('instruction', 'submission'))");
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE task_attachments DROP CONSTRAINT IF EXISTS task_attachments_kind_check');
        }

        Schema::table('task_attachments', function (Blueprint $table) {
            $table->dropIndex(['task_id', 'kind']);
            $table->dropColumn('kind');
        });
    }
};
