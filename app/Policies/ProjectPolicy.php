<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

/** Lapis 2: izin dinilai dari peran user di project ini. Admin dilewatkan lewat Gate::before. */
class ProjectPolicy
{
    public function view(User $user, Project $project): bool
    {
        return $user->canInProject('project.view', $project);
    }

    public function update(User $user, Project $project): bool
    {
        return $user->canInProject('project.update', $project);
    }

    public function delete(User $user, Project $project): bool
    {
        return $user->canInProject('project.delete', $project);
    }

    public function manageMembers(User $user, Project $project): bool
    {
        return $user->canInProject('project.member.manage', $project);
    }

    public function viewActivities(User $user, Project $project): bool
    {
        return $user->canInProject('activity.view', $project);
    }
}
