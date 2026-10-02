<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->restrictOnDelete();
            $table->string('title', 200);
            $table->text('description')->nullable();
            $table->string('status', 16)->default('todo'); // todo | in_progress | done (divalidasi di aplikasi)
            // smallint, bukan bigint; tanpa DEFAULT di DB (bawaan 'medium' ditetapkan di Form Request).
            $table->smallInteger('priority_id');
            $table->date('due_date')->nullable();
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('created_by_id')->constrained('users')->restrictOnDelete();
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('updated_at')->useCurrent();

            $table->foreign('priority_id')->references('id')->on('priorities')->restrictOnDelete();

            $table->index(['project_id', 'status']);
            $table->index('assignee_id');
            $table->index('due_date');
            $table->index('priority_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
