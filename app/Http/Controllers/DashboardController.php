<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Sumber tunggal dashboard: ringkasan angka per status dan daftar task
     * diambil dari satu snapshot yang sama, sehingga keduanya tidak mungkin
     * berselisih. Respons membawa ETag; klien yang mengirim If-None-Match
     * menerima 304 tanpa body selama data belum berubah, jadi polling rapat
     * tetap murah.
     */
    public function monitoring(Request $request): JsonResponse
    {
        $user = $request->user();

        // Lapis 2 (keanggotaan) lalu lapis 1 (izin task.view dari peran di project).
        $projects = Project::query()
            ->visibleTo($user)
            ->with(['members' => fn ($members) => $members
                ->with(['user:id,name', 'role:id,name'])
                ->orderBy('joined_at')->orderBy('id')])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get(['id', 'name', 'created_at'])
            ->filter(fn (Project $project) => $user->can('viewAny', [Task::class, $project]))
            ->values();

        $tasks = Task::query()
            ->whereIn('project_id', $projects->modelKeys())
            ->with(['assignee:id,name', 'assignees:id,name'])
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get(['id', 'project_id', 'title', 'status', 'assignee_id', 'created_at', 'updated_at'])
            ->groupBy('project_id');

        $rows = $projects->flatMap(function (Project $project) use ($tasks) {
            $managers = $project->members
                ->filter(fn ($member) => $member->role?->name === 'manager' && $member->user)
                ->map(fn ($member) => ['id' => $member->user->id, 'name' => $member->user->name])
                ->values()
                ->all();

            return ($tasks->get($project->id) ?? collect())->map(function (Task $task) use ($project, $managers) {
                // Multi-assignee dari pivot; kolom lama dipakai bila pivot kosong.
                $assignees = $task->assignees->isNotEmpty()
                    ? $task->assignees
                    : collect([$task->assignee])->filter();

                return [
                    'id' => $task->id,
                    'project_id' => $task->project_id,
                    'project' => ['id' => $project->id, 'name' => $project->name],
                    'title' => $task->title,
                    'status' => $task->status,
                    'assignees' => $assignees
                        ->map(fn ($person) => ['id' => $person->id, 'name' => $person->name])
                        ->values()
                        ->all(),
                    'managers' => $managers,
                    'updated_at' => $task->updated_at,
                ];
            });
        })->values();

        // Semua status selalu hadir (nol bila kosong) dengan urutan UI.
        $summary = array_fill_keys(Task::STATUSES, 0);
        foreach ($rows as $row) {
            if (array_key_exists($row['status'], $summary)) {
                $summary[$row['status']]++;
            }
        }

        $payload = [
            'summary' => $summary,
            'total' => $rows->count(),
            'data' => $rows->all(),
        ];

        $response = response()->json($payload);
        $response->setEtag(sha1((string) $response->getContent()));
        $response->headers->set('Cache-Control', 'private, no-cache');
        $response->isNotModified($request);

        return $response;
    }
}
