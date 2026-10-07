<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProjectMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manageMembers', $this->route('project'));
    }

    public function rules(): array
    {
        $project = $this->route('project');

        return [
            'user_id' => [
                'required', 'integer', Rule::exists('users', 'id'),
                Rule::unique('project_members', 'user_id')->where('project_id', $project->id),
            ],
            'role_id' => ['required', 'integer', UpdateProjectMemberRequest::projectRoleRule()],
        ];
    }

    public function messages(): array
    {
        return ['user_id.unique' => 'User sudah menjadi anggota project ini.'];
    }
}
