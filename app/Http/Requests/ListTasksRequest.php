<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListTasksRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->q)) {
            $this->merge(['q' => trim($this->q)]);
        }
    }

    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in([Task::STATUS_TODO, Task::STATUS_IN_PROGRESS, Task::STATUS_DONE])],
            'priority_id' => ['nullable', 'integer'],
            'assignee_id' => ['nullable', 'integer'],
            'sort' => ['nullable', Rule::in(['priority', 'due_date', 'created_at'])],
            'order' => ['nullable', Rule::in(['asc', 'desc'])],
        ];
    }
}
