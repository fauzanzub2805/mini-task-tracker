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
            'name' => $this->name,
            'size' => (int) $this->size,
            'mime_type' => $this->mime_type,
            'url' => route('tasks.attachments.download', [
                'task' => $this->task_id,
                'attachment' => $this->id,
            ]),
            'created_at' => $this->created_at,
        ];
    }
}
