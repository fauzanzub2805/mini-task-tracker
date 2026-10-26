<?php

namespace App\Http\Requests;

use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $task = $this->route('task');

        if (! $user->can('update', $task)) {
            return false;
        }

        // Staff boleh mengubah field lain, tetapi tidak boleh mengubah assignee.
        // Klien mengirim ulang daftar assignee saat menyimpan, jadi permintaan
        // hanya ditolak bila isinya benar-benar berbeda dari kondisi sekarang.
        if (! $this->changesAssignment($task)) {
            return true;
        }

        return $user->can('manageMembers', $task->project);
    }

    public function rules(): array
    {
        $task = $this->route('task');

        return [
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'required', Rule::in(Task::STATUSES)],
            'priority_id' => ['sometimes', 'required', 'integer', Rule::exists('priorities', 'id')],
            'due_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'assignee_id' => ['sometimes', 'nullable', 'integer', Rule::exists('project_members', 'user_id')->where('project_id', $task->project_id)],
            'assignee_ids' => ['sometimes', 'array'],
            'assignee_ids.*' => ['integer', 'distinct', Rule::exists('project_members', 'user_id')->where('project_id', $task->project_id)],
        ];
    }

    public function messages(): array
    {
        return [
            'assignee_id.exists' => 'Assignee harus anggota project ini.',
            'assignee_ids.*.exists' => 'Assignee harus anggota project ini.',
        ];
    }

    private function changesAssignment(Task $task): bool
    {
        if ($this->has('assignee_ids')) {
            $requested = $this->normalize($this->input('assignee_ids'));

            return $requested !== $this->normalize($task->assigneeIds());
        }

        if ($this->has('assignee_id')) {
            $value = $this->input('assignee_id');
            $requested = $value === null || $value === '' ? [] : [(int) $value];

            return $requested !== $this->normalize($task->assigneeIds());
        }

        return false;
    }

    /**
     * @param  mixed  $value
     * @return array<int, int>
     */
    private function normalize($value): array
    {
        $rows = is_array($value) ? $value : [];

        $ids = collect($rows)
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $ids;
    }
}
