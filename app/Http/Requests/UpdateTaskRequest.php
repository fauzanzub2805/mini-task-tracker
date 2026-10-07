<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('task'));
    }

    public function rules(): array
    {
        $task = $this->route('task');

        return [
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'required', Rule::in([Task::STATUS_TODO, Task::STATUS_IN_PROGRESS, Task::STATUS_DONE])],
            'priority_id' => ['sometimes', 'required', 'integer', Rule::exists('priorities', 'id')],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'assignee_id' => ['sometimes', 'nullable', 'integer', Rule::exists('project_members', 'user_id')->where('project_id', $task->project_id)],
        ];
    }

    public function messages(): array
    {
        return ['assignee_id.exists' => 'Assignee harus anggota project ini.'];
    }
}
