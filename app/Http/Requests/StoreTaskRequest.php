<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [Task::class, $this->route('project')]);
    }

    public function rules(): array
    {
        $project = $this->route('project');

        return [
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in([Task::STATUS_TODO, Task::STATUS_IN_PROGRESS, Task::STATUS_DONE])],
            // Bawaan 'medium' ditetapkan di controller bila tidak dikirim.
            'priority_id' => ['nullable', 'integer', Rule::exists('priorities', 'id')],
            'due_date' => ['nullable', 'date_format:Y-m-d'],
            // Assignee wajib anggota project (PRD 4.5).
            'assignee_id' => ['nullable', 'integer', Rule::exists('project_members', 'user_id')->where('project_id', $project->id)],
        ];
    }

    public function messages(): array
    {
        return ['assignee_id.exists' => 'Assignee harus anggota project ini.'];
    }
}
