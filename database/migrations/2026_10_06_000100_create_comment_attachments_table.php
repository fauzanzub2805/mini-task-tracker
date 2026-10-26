<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lampiran komentar disimpan di disk privat (sama seperti lampiran task) dan
 * terikat ke komentar, bukan ke task, agar file hanya muncul pada komentar
 * tempat ia diunggah.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comment_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('comment_id')->constrained('comments')->cascadeOnDelete();
            $table->foreignId('uploaded_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name', 255);            // nama asli dari klien
            $table->string('path', 512);            // path relatif pada disk privat
            $table->string('mime_type', 150)->nullable();
            $table->unsignedBigInteger('size');     // byte, maks 10 MiB divalidasi aplikasi
            $table->timestampTz('created_at')->useCurrent();

            $table->index('comment_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_attachments');
    }
};
