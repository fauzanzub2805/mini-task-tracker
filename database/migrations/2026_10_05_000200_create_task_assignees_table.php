<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Satu task boleh punya beberapa assignee (desain Assignee picker).
 * Kolom tasks.assignee_id tetap dipertahankan sebagai assignee utama agar
 * API lama (dan filter assignee_id) tetap kompatibel.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('task_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['task_id', 'user_id']);
            $table->index('user_id');
        });

        // Backfill: assignee lama menjadi assignee pertama di pivot.
        DB::table('tasks')
            ->whereNotNull('assignee_id')
            ->orderBy('id')
            ->select(['id', 'assignee_id'])
            ->chunk(500, function ($rows) {
                $now = now();
                DB::table('task_assignees')->insertOrIgnore($rows->map(fn ($row) => [
                    'task_id' => $row->id,
                    'user_id' => $row->assignee_id,
                    'created_at' => $now,
                ])->all());
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('task_assignees');
    }
};
