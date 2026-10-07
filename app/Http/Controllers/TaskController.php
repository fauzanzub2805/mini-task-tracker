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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class TaskController extends Controller
{
    public function __construct(private ActivityLogger $activities) {}

    public function index(ListTasksRequest $request, Project $project)
    {
        Gate::authorize('viewAny', [Task::class, $project]);

        $order = $request->input('order', 'desc');
        $sort = $request->input('sort', 'created_at');

        $query = Task::query()
            ->select('tasks.*')
            ->with(['priority', 'assignee'])
            ->where('tasks.project_id', $project->id)
            ->when($request->filled('status'), fn ($q) => $q->where('tasks.status', $request->status))
            ->when($request->filled('priority_id'), fn ($q) => $q->where('tasks.priority_id', $request->priority_id))
            ->when($request->filled('assignee_id'), fn ($q) => $q->where('tasks.assignee_id', $request->assignee_id))
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

        $task = DB::transaction(function () use ($request, $project) {
            $task = Task::create([
                'project_id' => $project->id,
                'title' => $request->title,
                'description' => $request->description,
                'status' => $request->input('status', Task::STATUS_TODO),
                // Bawaan 'medium' ditetapkan di sisi aplikasi.
                'priority_id' => $request->input('priority_id') ?? Priority::where('name', 'medium')->firstOrFail()->id,
                'due_date' => $request->due_date,
                'assignee_id' => $request->assignee_id,
                'created_by_id' => $request->user()->id,
            ]);

            $this->activities->log($request->user(), $project, 'task.created', "membuat task \"{$task->title}\"", $task);

            return $task;
        });

        return (new TaskResource($task->load(['priority', 'assignee'])))->response()->setStatusCode(201);
    }

    public function show(Task $task): TaskResource
    {
        Gate::authorize('view', $task);

        return new TaskResource($task->load(['priority', 'assignee']));
    }

    public function update(UpdateTaskRequest $request, Task $task): TaskResource
    {
        Gate::authorize('update', $task);

        DB::transaction(function () use ($request, $task) {
            $old = $task->only(['status', 'priority_id', 'assignee_id']);
            $task->fill($request->validated());
            $dirty = $task->getDirty();

            if (! $dirty) {
                return;
            }

            $task->save();
            $actor = $request->user();

            // Satu perubahan = satu baris aktivitas.
            if (array_key_exists('status', $dirty)) {
                $this->activities->log($actor, $task->project_id, 'task.status_changed',
                    "mengubah status dari {$old['status']} ke {$task->status}", $task);
            }
            if (array_key_exists('priority_id', $dirty)) {
                $from = Priority::find($old['priority_id'])?->name;
                $to = Priority::find($task->priority_id)?->name;
                $this->activities->log($actor, $task->project_id, 'task.priority_changed',
                    "mengubah prioritas dari {$from} ke {$to}", $task);
            }
            if (array_key_exists('assignee_id', $dirty)) {
                $name = $task->assignee_id ? User::find($task->assignee_id)->name : null;
                $this->activities->log($actor, $task->project_id, 'task.assigned',
                    $name ? "menugaskan task ke {$name}" : 'menghapus assignee task', $task);
            }

            $other = array_values(array_diff(array_keys($dirty), ['status', 'priority_id', 'assignee_id', 'updated_at']));
            if ($other) {
                $this->activities->log($actor, $task->project_id, 'task.updated',
                    'mengubah task ('.implode(', ', $other).')', $task);
            }
        });

        return new TaskResource($task->load(['priority', 'assignee']));
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
}
