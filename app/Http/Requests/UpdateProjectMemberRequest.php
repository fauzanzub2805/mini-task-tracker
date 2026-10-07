<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProjectMemberRequest extends FormRequest
{
    /** Peran di dalam project hanya manager atau staff (PRD 4.1). */
    public static function projectRoleRule(): \Illuminate\Validation\Rules\Exists
    {
        return Rule::exists('roles', 'id')
            ->where(fn ($q) => $q->where('guard_name', 'web')->whereIn('name', ['manager', 'staff']));
    }

    public function rules(): array
    {
        return [
            'role_id' => ['required', 'integer', self::projectRoleRule()],
        ];
    }
}
