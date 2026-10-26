<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'task_id' => $this->task_id,
            'author' => $this->whenLoaded('author', fn () => $this->author ? [
                'id' => $this->author->id,
                'name' => $this->author->name,
            ] : null),
            'author_id' => $this->author_id,
            'body' => $this->body,
            'mentions' => $this->whenLoaded('mentions', fn () => $this->mentions
                ->map(fn ($user) => ['id' => $user->id, 'name' => $user->name])
                ->values()
                ->all()),
            'attachments' => CommentAttachmentResource::collection($this->whenLoaded('attachments')),
            'created_at' => $this->created_at,
        ];
    }
}
