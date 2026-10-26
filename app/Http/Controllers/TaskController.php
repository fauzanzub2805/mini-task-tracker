<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListTasksRequest;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Priority;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\View\View;

class TaskController extends Controller
{
    /** Relasi yang selalu dimuat agar TaskResource selalu lengkap. */
    private const RELATIONS = ['priority', 'assignee', 'assignees', 'creator', 'project', 'attachments'];

    public function __construct(private ActivityLogger $activities) {}

    public function index(ListTasksRequest $request, Project $project)
    {
        Gate::authorize('viewAny', [Task::class, $project]);

        $order = $request->input('order', 'desc');
        $sort = $request->input('sort', 'created_at');

        $query = Task::query()
            ->select('tasks.*')
            ->with(self::RELATIONS)
            ->where('tasks.project_id', $project->id)
            ->when($request->filled('status'), fn ($q) => $q->where('tasks.status', $request->status))
            ->when($request->filled('priority_id'), fn ($q) => $q->where('tasks.priority_id', $request->priority_id))
            // Filter assignee mencakup semua assignee (pivot), bukan hanya yang utama.
            ->when($request->filled('assignee_id'), fn ($q) => $q->assignedTo((int) $request->assignee_id))
            ->when($request->filled('q'), function ($q) use ($request) {
                // Escape wildcard agar % dan _ dibaca sebagai teks biasa.
                $term = addcslashes($request->q, '\\%_');

                $q->where('tasks.title', 'ilike', "%{$term}%");
            });

        if ($sort === 'priority') {
            // Urut berdasarkan level, bukan id atau abjad.
            $query->join('priorities', 'priorities.id', '=', 'tasks.priority_id')
                ->orderBy('priorities.level', $order);
        } else {
            $query->orderBy("tasks.{$sort}", $order);
        }

        return TaskResource::collection($query->orderBy('tasks.id', $order)->paginate(25));
    }

    public function store(StoreTaskRequest $request, Project $project): JsonResponse
    {
        Gate::authorize('create', [Task::class, $project]);

        $assigneeIds = $this->assigneeIdsFrom($request);

        $task = DB::transaction(function () use ($request, $project, $assigneeIds) {
            // assignee_ids bukan kolom tabel tasks: dikelola lewat pivot.
            $data = $request->safe()->except(['assignee_ids', 'assignee_id']);

            $task = Task::create([
                'project_id' => $project->id,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? Task::STATUS_TODO,
                // Bawaan 'medium' ditetapkan di sisi aplikasi.
                'priority_id' => $data['priority_id'] ?? Priority::where('name', 'medium')->firstOrFail()->id,
                'due_date' => $data['due_date'] ?? null,
                'assignee_id' => $assigneeIds[0] ?? null,
                'created_by_id' => $request->user()->id,
            ]);

            $task->syncAssignees($assigneeIds);

            $this->activities->log($request->user(), $project, 'task.created', "membuat task \"{$task->title}\"", $task);

            if ($assigneeIds !== []) {
                $this->activities->log($request->user(), $project, 'task.assigned',
                    'menugaskan task ke '.$this->names($assigneeIds), $task);
            }

            return $task;
        });

        return (new TaskResource($task->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    public function show(Task $task): TaskResource
    {
        Gate::authorize('view', $task);

        return new TaskResource($task->load(self::RELATIONS));
    }

    /**
     * Halaman detail task. URL `/projects/{project}/tasks/{task}` dipakai UI;
     * task harus benar-benar milik project pada URL.
     */
    public function page(Request $request, Project $project, Task $task): View|TaskResource
    {
        abort_unless((int) $task->project_id === (int) $project->id, 404);

        Gate::authorize('view', $task);

        if ($this->wantsHtml($request)) {
            return view('dashboard');
        }

        return new TaskResource($task->load(self::RELATIONS));
    }

    public function update(UpdateTaskRequest $request, Task $task): TaskResource
    {
        Gate::authorize('update', $task);

        DB::transaction(function () use ($request, $task) {
            $oldStatus = $task->status;
            $oldPriorityId = $task->priority_id;
            $oldAssigneeIds = $task->assigneeIds();

            // assignee_ids/assignee_id tidak di-fill: assignee dikelola pivot.
            $task->fill($request->safe()->except(['assignee_ids', 'assignee_id']));
            $dirty = $task->getDirty();

            if ($dirty) {
                $task->save();
            }

            $requested = $this->requestedAssigneeIds($request);
            $assigneesChanged = $requested !== null
                && $this->sortedUnique($requested) !== $this->sortedUnique($oldAssigneeIds);

            if ($assigneesChanged) {
                $task->syncAssignees($requested);
            }

            if (! $dirty && ! $assigneesChanged) {
                return;
            }

            $actor = $request->user();

            // Satu perubahan = satu baris aktivitas.
            if (array_key_exists('status', $dirty)) {
                $this->activities->log($actor, $task->project_id, 'task.status_changed',
                    "mengubah status dari {$oldStatus} ke {$task->status}", $task);
            }
            if (array_key_exists('priority_id', $dirty)) {
                $from = Priority::find($oldPriorityId)?->name;
                $to = Priority::find($task->priority_id)?->name;
                $this->activities->log($actor, $task->project_id, 'task.priority_changed',
                    "mengubah prioritas dari {$from} ke {$to}", $task);
            }
            if ($assigneesChanged) {
                $this->activities->log($actor, $task->project_id, 'task.assigned',
                    $requested === []
                        ? 'menghapus assignee task'
                        : 'menugaskan task ke '.$this->names($requested), $task);
            }

            $other = array_values(array_diff(array_keys($dirty), ['status', 'priority_id', 'assignee_id', 'updated_at']));
            if ($other) {
                $this->activities->log($actor, $task->project_id, 'task.updated',
                    'mengubah task ('.implode(', ', $other).')', $task);
            }
        });

        return new TaskResource($task->load(self::RELATIONS));
    }

    public function destroy(Task $task): JsonResponse
    {
        Gate::authorize('delete', $task);

        DB::transaction(function () use ($task) {
            // Dicatat sebelum dihapus; task_id pada aktivitas dikosongkan oleh DB (R14).
            $this->activities->log(request()->user(), $task->project_id, 'task.deleted', "menghapus task \"{$task->title}\"", $task);
            $task->delete();
        });

        return response()->json(null, 204);
    }

    /**
     * Daftar assignee dari payload: `assignee_ids` diutamakan, lalu `assignee_id`.
     *
     * @return array<int, int>
     */
    private function assigneeIdsFrom(Request $request): array
    {
        if ($request->has('assignee_ids')) {
            $raw = $request->input('assignee_ids');
            $rows = is_array($raw) ? $raw : [];

            return $this->sortedUnique($rows);
        }

        $single = $request->input('assignee_id');

        return $single === null || $single === '' ? [] : [(int) $single];
    }

    /**
     * Null berarti payload tidak menyentuh assignee sama sekali.
     *
     * @return array<int, int>|null
     */
    private function requestedAssigneeIds(Request $request): ?array
    {
        if (! $request->has('assignee_ids') && ! $request->has('assignee_id')) {
            return null;
        }

        return $this->assigneeIdsFrom($request);
    }

    /**
     * @param  array<int, mixed>  $ids
     * @return array<int, int>
     */
    private function sortedUnique(array $ids): array
    {
        $clean = collect($ids)
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $clean;
    }

    /** @param  array<int, int>  $ids */
    private function names(array $ids): string
    {
        return User::query()
            ->whereIn('id', $ids)
            ->orderBy('name')
            ->pluck('name')
            ->implode(', ');
    }
}
