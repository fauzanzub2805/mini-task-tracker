<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * Lampiran komentar. Disk privat, jadi `url` selalu menunjuk endpoint unduh
 * yang memeriksa izin. `preview_url` hanya untuk kandidat gambar raster; server
 * tetap memvalidasi tipe file sebenarnya sebelum menyajikan inline.
 */
class CommentAttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $previewable = Str::startsWith((string) $this->mime_type, 'image/');

        return [
            'id' => $this->id,
            'comment_id' => $this->comment_id,
            'name' => $this->name,
            'size' => (int) $this->size,
            'mime_type' => $this->mime_type,
            'url' => route('comments.attachments.download', [
                'task' => $this->comment->task_id,
                'comment' => $this->comment_id,
                'attachment' => $this->id,
            ]),
            'preview_url' => $previewable ? route('comments.attachments.preview', [
                'task' => $this->comment->task_id,
                'comment' => $this->comment_id,
                'attachment' => $this->id,
            ]) : null,
            'created_at' => $this->created_at,
        ];
    }
}
