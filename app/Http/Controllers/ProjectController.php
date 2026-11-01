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
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;
use Spatie\Permission\Models\Role;

class ProjectController extends Controller
{
    public function __construct(private ActivityLogger $activities) {}

    public function index(Request $request)
    {
        // Halaman HTML dan API berbagi URL; JSON tetap bawaan.
        if ($this->wantsHtml($request)) {
            return view('dashboard');
        }

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

        $imagePath = null;
        try {
            $project = DB::transaction(function () use ($request, $user, &$imagePath) {
                $project = Project::create([
                    'name' => $request->name,
                    'description' => $request->description,
                    'created_by_id' => $user->id,
                ]);

                if ($request->hasFile('image')) {
                    $imagePath = $request->file('image')->store("project-images/{$project->id}", 'local');
                    abort_unless($imagePath, 500, 'Gambar project tidak dapat disimpan.');
                    $project->image_path = $imagePath;
                    $project->save();
                }

                // Pembuat otomatis menjadi anggota berperan manager.
                ProjectMember::create([
                    'project_id' => $project->id,
                    'user_id' => $user->id,
                    'role_id' => Role::findByName('manager', 'web')->id,
                ]);

                $this->activities->log($user, $project, 'project.created', "membuat project \"{$project->name}\"");

                return $project;
            });
        } catch (\Throwable $failure) {
            if ($imagePath) {
                Storage::disk('local')->delete($imagePath);
            }
            throw $failure;
        }

        return (new ProjectResource($project->loadCount(['members', 'tasks'])))->response()->setStatusCode(201);
    }

    public function show(Request $request, Project $project): ProjectResource|View
    {
        Gate::authorize('view', $project);

        // Halaman detail project (UI) dilayani Blade hanya bila klien meminta HTML.
        if ($this->wantsHtml($request)) {
            return view('dashboard');
        }

        return new ProjectResource($project->loadCount(['members', 'tasks']));
    }

    public function update(UpdateProjectRequest $request, Project $project): ProjectResource
    {
        Gate::authorize('update', $project);

        $disk = Storage::disk('local');
        $newPath = null;
        $oldPath = null;

        try {
            if ($request->hasFile('image')) {
                $newPath = $request->file('image')->store("project-images/{$project->id}", 'local');
                abort_unless($newPath, 500, 'Gambar project tidak dapat disimpan.');
            }

            DB::transaction(function () use ($request, $project, $newPath, &$oldPath) {
                // Serialize replacements so concurrent saves cannot orphan the previous image.
                $current = Project::query()->lockForUpdate()->findOrFail($project->id);
                $current->fill($request->safe()->only(['name', 'description']));
                if ($newPath || $request->boolean('remove_image')) {
                    $oldPath = $current->image_path;
                    $current->image_path = $newPath;
                }

                if ($current->isDirty()) {
                    $fields = implode(', ', array_keys($current->getDirty()));
                    $current->save();
                    $this->activities->log($request->user(), $current, 'project.updated', "mengubah project ({$fields})");
                }
            });
        } catch (\Throwable $failure) {
            if ($newPath) {
                $disk->delete($newPath);
            }
            throw $failure;
        }

        if ($oldPath) {
            $disk->delete($oldPath);
        }
        $project->refresh();

        return new ProjectResource($project->loadCount(['members', 'tasks']));
    }

    /** Private image URL: the same project view policy applies as to its details. */
    public function image(Project $project)
    {
        Gate::authorize('view', $project);
        $disk = Storage::disk('local');
        abort_unless($project->image_path && $disk->exists($project->image_path), 404);
        $mime = $disk->mimeType($project->image_path);
        abort_unless(in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true), 404);

        return response()->file($disk->path($project->image_path), [
            'Content-Type' => $mime,
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'",
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }

    /** Gagal bila masih ada task (R8, ON DELETE RESTRICT). */
    public function destroy(Project $project): JsonResponse
    {
        Gate::authorize('delete', $project);

        if ($project->tasks()->exists()) {
            return response()->json(['message' => 'Project masih berisi task dan tidak bisa dihapus.'], 409);
        }

        $imagePath = $project->image_path;
        $project->delete();
        if ($imagePath) {
            Storage::disk('local')->delete($imagePath);
        }

        return response()->json(null, 204);
    }
}
