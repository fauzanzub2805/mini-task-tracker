<?php

namespace App\Http\Controllers;

use App\Http\Resources\ActivityResource;
use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Support\Facades\Gate;

/** Hanya baca. Tidak ada endpoint ubah atau hapus. */
class ActivityController extends Controller
{
    public function project(Project $project)
    {
        Gate::authorize('viewActivities', $project);

        return $this->respond(Activity::where('project_id', $project->id));
    }

    public function task(Task $task)
    {
        Gate::authorize('viewActivities', $task);

        return $this->respond(Activity::where('task_id', $task->id));
    }

    private function respond($query)
    {
        return ActivityResource::collection(
            $query->with('user')->orderByDesc('created_at')->orderByDesc('id')->paginate(20)
        );
    }
}
