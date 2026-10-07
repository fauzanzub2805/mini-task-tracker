<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Spatie\Permission\Models\Role;

class ProjectController extends Controller
{
    public function __construct(private ActivityLogger $activities) {}

    public function index(Request $request)
    {
        $projects = Project::query()
            ->visibleTo($request->user())
            ->withCount(['members', 'tasks'])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(25);

        return ProjectResource::collection($projects);
    }

    /** Dinilai dari peran global (lapis 1): izin project.create. */
    public function store(StoreProjectRequest $request): JsonResponse
    {
        Gate::authorize('project.create');

        $user = $request->user();

        $project = DB::transaction(function () use ($request, $user) {
            $project = Project::create([
                'name' => $request->name,
                'description' => $request->description,
                'created_by_id' => $user->id,
            ]);

            // Pembuat otomatis menjadi anggota berperan manager.
            ProjectMember::create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'role_id' => Role::findByName('manager', 'web')->id,
            ]);

            $this->activities->log($user, $project, 'project.created', "membuat project \"{$project->name}\"");

            return $project;
        });

        return (new ProjectResource($project->loadCount(['members', 'tasks'])))->response()->setStatusCode(201);
    }

    public function show(Project $project): ProjectResource
    {
        Gate::authorize('view', $project);

        return new ProjectResource($project->loadCount(['members', 'tasks']));
    }

    public function update(UpdateProjectRequest $request, Project $project): ProjectResource
    {
        Gate::authorize('update', $project);

        DB::transaction(function () use ($request, $project) {
            $project->fill($request->validated());

            if ($project->isDirty()) {
                $fields = implode(', ', array_keys($project->getDirty()));
                $project->save();
                $this->activities->log($request->user(), $project, 'project.updated', "mengubah project ({$fields})");
            }
        });

        return new ProjectResource($project->loadCount(['members', 'tasks']));
    }

    /** Gagal bila masih ada task (R8, ON DELETE RESTRICT). */
    public function destroy(Project $project): JsonResponse
    {
        Gate::authorize('delete', $project);

        if ($project->tasks()->exists()) {
            return response()->json(['message' => 'Project masih berisi task dan tidak bisa dihapus.'], 409);
        }

        $project->delete();

        return response()->json(null, 204);
    }
}
