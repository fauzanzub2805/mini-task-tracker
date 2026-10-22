<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDirectMessageRequest extends FormRequest
{
    /**
     * Jenis file yang boleh diunggah. HTML/SVG/script/executable sengaja
     * dikecualikan agar lampiran tidak bisa dipakai untuk menyajikan aktif
     * content dari domain aplikasi.
     */
    public const ALLOWED_EXTENSIONS = [
        'pdf', 'txt', 'csv', 'zip',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        'png', 'jpg', 'jpeg', 'gif', 'webp',
    ];

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'body' => ['nullable', 'required_without:attachment', 'string', 'max:4000'],
            'attachment' => [
                'nullable',
                'required_without:body',
                'file',
                'max:10240', // KB == 10 MB
                'mimes:'.implode(',', self::ALLOWED_EXTENSIONS),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'body.required_without' => 'Isi pesan atau lampiran wajib diisi.',
            'attachment.required_without' => 'Isi pesan atau lampiran wajib diisi.',
            'attachment.mimes' => 'Jenis file tidak diizinkan.',
            'attachment.max' => 'Ukuran lampiran maksimal 10 MB.',
            'body.max' => 'Pesan maksimal 4000 karakter.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $body = trim((string) $this->input('body', ''));

            if ($body === '' && ! $this->hasFile('attachment')) {
                $validator->errors()->add('body', 'Isi pesan atau lampiran wajib diisi.');
            }
        });
    }
}
