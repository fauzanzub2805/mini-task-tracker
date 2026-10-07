<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

class CommentPolicy
{
    public function create(User $user, Task $task): bool
    {
        return $user->canInProject('comment.create', $task->project_id);
    }
}
