<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Lampiran task disimpan di disk privat (storage/app/private), bukan URL publik. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('uploaded_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name', 255);            // nama asli dari klien
            $table->string('path', 512);            // path relatif pada disk privat
            $table->string('mime_type', 150)->nullable();
            $table->unsignedBigInteger('size');     // byte, maks 10 MiB divalidasi aplikasi
            $table->timestampTz('created_at')->useCurrent();

            $table->index('task_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_attachments');
    }
};
