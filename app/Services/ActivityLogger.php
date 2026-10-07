<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use InvalidArgumentException;

/**
 * Pencatat audit trail (TSD bagian 5). Dipanggil dari controller, di dalam
 * transaksi yang sama dengan aksinya. Pelaku selalu user yang sedang login.
 */
class ActivityLogger
{
    public function log(User $actor, Project|int $project, string $action, ?string $description = null, Task|int|null $task = null): Activity
    {
        if (! in_array($action, Activity::ACTIONS, true)) {
            throw new InvalidArgumentException("Action activity tidak dikenal: {$action}");
        }

        return Activity::create([
            'project_id' => $project instanceof Project ? $project->id : $project,
            'task_id' => $task instanceof Task ? $task->id : $task,
            'user_id' => $actor->id,
            'action' => $action,
            'description' => $description,
        ]);
    }
}
