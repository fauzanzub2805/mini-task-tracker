<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreProjectMemberRequest;
use App\Http\Requests\UpdateProjectMemberRequest;
use App\Http\Resources\ProjectMemberResource;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Spatie\Permission\Models\Role;

class ProjectMemberController extends Controller
{
    public function __construct(private ActivityLogger $activities) {}

    public function index(Project $project)
    {
        Gate::authorize('view', $project);

        return ProjectMemberResource::collection(
            $project->members()->with(['user', 'role'])->orderBy('joined_at')->orderBy('id')->paginate(25)
        );
    }

    public function store(StoreProjectMemberRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('manageMembers', $project);

        $member = DB::transaction(function () use ($request, $project) {
            $member = ProjectMember::create([
                'project_id' => $project->id,
                'user_id' => $request->user_id,
                'role_id' => $request->role_id,
            ]);

            $name = User::find($request->user_id)->name;
            $role = Role::find($request->role_id)->name;
            $this->activities->log($request->user(), $project, 'project.member_added', "menambahkan {$name} sebagai {$role}");

            return $member;
        });

        return (new ProjectMemberResource($member->load(['user', 'role'])))->response()->setStatusCode(201);
    }

    public function update(UpdateProjectMemberRequest $request, Project $project, int $userId): ProjectMemberResource
    {
        Gate::authorize('manageMembers', $project);

        $member = ProjectMember::where('project_id', $project->id)->where('user_id', $userId)->firstOrFail();
        $member->update(['role_id' => $request->role_id]);

        return new ProjectMemberResource($member->load(['user', 'role']));
    }

    public function destroy(Project $project, int $userId): JsonResponse
    {
        Gate::authorize('manageMembers', $project);

        $member = ProjectMember::with('user')->where('project_id', $project->id)->where('user_id', $userId)->firstOrFail();

        DB::transaction(function () use ($member, $project) {
            $this->activities->log(request()->user(), $project, 'project.member_removed', "mengeluarkan {$member->user->name} dari project");
            $member->delete();
        });

        return response()->json(null, 204);
    }
}
