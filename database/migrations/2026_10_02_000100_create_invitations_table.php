<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invitations', function (Blueprint $table) {
            $table->id();
            $table->string('email', 255)->unique();      // lowercase, divalidasi di aplikasi
            $table->string('token', 64)->unique();
            // FK ke users ditambahkan di migration terpisah (FK melingkar dengan users).
            // NULL hanya pada baris bootstrap.
            $table->unsignedBigInteger('invited_by_id')->nullable();
            $table->foreignId('role_id')
                ->constrained(config('permission.table_names.roles'))
                ->restrictOnDelete();
            $table->string('status', 16)->default('pending'); // pending | accepted | revoked (divalidasi di aplikasi)
            $table->timestampTz('expires_at');
            $table->timestampTz('accepted_at')->nullable();
            $table->timestampTz('created_at')->useCurrent();

            $table->index(['status', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
    }
};
