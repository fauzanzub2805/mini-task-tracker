<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            // Gerbang: tidak ada akun tanpa undangan.
            $table->foreignId('invitation_id')
                ->unique()
                ->constrained('invitations')
                ->restrictOnDelete();
            $table->string('name', 100);
            $table->string('email', 255)->unique();
            $table->string('password_hash', 255);
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
