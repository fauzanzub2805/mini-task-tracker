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

        $member = DB::transaction(function () use ($request, $project, $userId) {
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $member = ProjectMember::where('project_id', $project->id)->where('user_id', $userId)->firstOrFail();
            $managerRoleId = Role::findByName('manager', 'web')->id;
            if ((int) $request->role_id !== (int) $managerRoleId) {
                $this->guardLastManager($project, $member, $managerRoleId);
            }
            $member->update(['role_id' => $request->role_id]);

            return $member;
        });

        return new ProjectMemberResource($member->load(['user', 'role']));
    }

    public function destroy(Project $project, int $userId): JsonResponse
    {
        Gate::authorize('manageMembers', $project);

        DB::transaction(function () use ($userId, $project) {
            // Role changes and removals share this lock to preserve at least one manager.
            Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            $member = ProjectMember::with('user')->where('project_id', $project->id)->where('user_id', $userId)->firstOrFail();
            $this->guardLastManager($project, $member, Role::findByName('manager', 'web')->id);
            $this->activities->log(request()->user(), $project, 'project.member_removed', "mengeluarkan {$member->user->name} dari project");
            $member->delete();
        });

        return response()->json(null, 204);
    }

    private function guardLastManager(Project $project, ProjectMember $member, int $managerRoleId): void
    {
        if ((int) $member->role_id === $managerRoleId) {
            abort_if(
                ! $project->members()->where('role_id', $managerRoleId)->where('id', '!=', $member->id)->exists(),
                409,
                'Project harus memiliki setidaknya satu manager. Tambahkan manager lain terlebih dahulu.'
            );
        }
    }
}
