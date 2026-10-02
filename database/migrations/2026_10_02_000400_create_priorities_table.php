<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('priorities', function (Blueprint $table) {
            $table->smallIncrements('id');              // smallserial
            $table->string('name', 20)->unique();       // low | medium | high (diisi seeder)
            $table->smallInteger('level')->unique();    // low 1, medium 2, high 3
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('priorities');
    }
};
