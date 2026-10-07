<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;

class TaskPolicy
{
    public function viewAny(User $user, Project $project): bool
    {
        return $user->canInProject('task.view', $project);
    }

    public function create(User $user, Project $project): bool
    {
        return $user->canInProject('task.create', $project);
    }

    public function view(User $user, Task $task): bool
    {
        return $user->canInProject('task.view', $task->project_id);
    }

    public function update(User $user, Task $task): bool
    {
        return $user->canInProject('task.update', $task->project_id);
    }

    public function delete(User $user, Task $task): bool
    {
        return $user->canInProject('task.delete', $task->project_id);
    }

    public function viewActivities(User $user, Task $task): bool
    {
        return $user->canInProject('activity.view', $task->project_id);
    }
}
