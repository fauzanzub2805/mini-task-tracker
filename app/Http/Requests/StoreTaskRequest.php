<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        if (! $user->can('create', [Task::class, $project])) {
            return false;
        }

        // Hanya Project Manager (atau Admin) yang boleh menentukan assignee.
        $assignees = $this->assignmentIds();

        return $assignees === [] || $user->can('manageMembers', $project);
    }

    public function rules(): array
    {
        $project = $this->route('project');

        return [
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(Task::STATUSES)],
            // Bawaan 'medium' ditetapkan di controller bila tidak dikirim.
            'priority_id' => ['nullable', 'integer', Rule::exists('priorities', 'id')],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            // Assignee wajib anggota project (PRD 4.5).
            'assignee_id' => ['nullable', 'integer', Rule::exists('project_members', 'user_id')->where('project_id', $project->id)],
            'assignee_ids' => ['sometimes', 'array'],
            'assignee_ids.*' => ['integer', 'distinct', Rule::exists('project_members', 'user_id')->where('project_id', $project->id)],
        ];
    }

    public function messages(): array
    {
        return [
            'assignee_id.exists' => 'Assignee harus anggota project ini.',
            'assignee_ids.*.exists' => 'Assignee harus anggota project ini.',
        ];
    }

    /** @return array<int, int> */
    private function assignmentIds(): array
    {
        $raw = $this->input('assignee_ids', array_filter([$this->input('assignee_id')]));

        return collect(is_array($raw) ? $raw : [])
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}
