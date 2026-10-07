<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

/** Body: { token, name, password }. Email dan peran diambil dari undangan, bukan dari form. */
class RegisterRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'token' => ['required', 'string'],
            'name' => ['required', 'string', 'max:100'],
            'password' => ['required', 'string', Password::min(8)],
        ];
    }
}
