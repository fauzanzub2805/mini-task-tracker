<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DirectMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sender_id' => $this->sender_id,
            'recipient_id' => $this->recipient_id,
            'body' => $this->body,
            'created_at' => $this->created_at?->toIso8601String(),
            'read_at' => $this->read_at?->toIso8601String(),
            'attachment' => $this->hasAttachment() ? [
                'name' => $this->attachment_name,
                'size' => $this->attachment_size,
                'url' => route('messaging.messages.attachment', ['message' => $this->id]),
            ] : null,
        ];
    }
}
