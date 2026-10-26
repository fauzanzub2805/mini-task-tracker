<?php

namespace App\Http\Requests;

use App\Models\Comment;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCommentRequest extends FormRequest
{
    /** 10 MiB dalam kilobyte, sama dengan lampiran task. */
    private const MAX_KILOBYTES = 10240;

    public function authorize(): bool
    {
        return $this->user()->can('create', [Comment::class, $this->route('task')]);
    }

    public function rules(): array
    {
        $task = $this->route('task');

        return [
            // Komentar boleh hanya berisi file; teks wajib bila tanpa file.
            'body' => ['required_without:files', 'nullable', 'string'],
            'files' => ['sometimes', 'array'],
            'files.*' => ['required', 'file', 'max:'.self::MAX_KILOBYTES],
            // Mention hanya boleh untuk anggota project task tersebut.
            'mention_ids' => ['sometimes', 'array'],
            'mention_ids.*' => [
                'integer', 'distinct',
                Rule::exists('project_members', 'user_id')->where('project_id', $task->project_id),
            ],
        ];
    }

    /**
     * Teks kosong (spasi) dianggap tidak ada, sehingga komentar harus punya file.
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $body = trim((string) $this->input('body', ''));
            $files = $this->file('files', []);

            if ($body === '' && count(is_array($files) ? $files : [$files]) === 0) {
                $validator->errors()->add('body', 'Tulis komentar atau lampirkan minimal satu file.');
            }
        }];
    }

    public function messages(): array
    {
        return [
            'body.required_without' => 'Tulis komentar atau lampirkan minimal satu file.',
            'files.*.max' => 'Ukuran setiap file maksimal 10 MB.',
            'files.*.file' => 'Berkas yang diunggah tidak valid.',
            'mention_ids.*.exists' => 'User yang di-mention harus anggota project ini.',
        ];
    }
}
