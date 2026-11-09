<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Lampiran file task. Disk-nya privat, jadi URL selalu menunjuk ke endpoint
 * unduh yang memeriksa izin (bukan tautan storage publik).
 */
class TaskAttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'name' => $this->name,
            'size' => (int) $this->size,
            'mime_type' => $this->mime_type,
            // Pengirim berkas (dipakai sebagai "Nama Pengirim" di Submitted Files).
            'uploaded_by' => $this->whenLoaded('uploader', fn () => $this->uploader ? [
                'id' => $this->uploader->id,
                'name' => $this->uploader->name,
            ] : null),
            'url' => route('tasks.attachments.download', [
                'task' => $this->task_id,
                'attachment' => $this->id,
            ]),
            'preview_url' => route('tasks.attachments.preview', [
                'task' => $this->task_id,
                'attachment' => $this->id,
            ]),
            'created_at' => $this->created_at,
        ];
    }
}
