<?php

namespace App\Http\Requests;

use App\Models\Comment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCommentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [Comment::class, $this->route('task')]);
    }

    public function rules(): array
    {
        $task = $this->route('task');

        return [
            'body' => ['required', 'string'],
            // Mention hanya boleh untuk anggota project task tersebut.
            'mention_ids' => ['sometimes', 'array'],
            'mention_ids.*' => [
                'integer', 'distinct',
                Rule::exists('project_members', 'user_id')->where('project_id', $task->project_id),
            ],
        ];
    }

    public function messages(): array
    {
        return ['mention_ids.*.exists' => 'User yang di-mention harus anggota project ini.'];
    }
}
