<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Token sengaja tidak ditampilkan: rahasia hanya ada di tautan yang dikirim ke email. */
class InvitationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->whenLoaded('role', fn () => ['id' => $this->role->id, 'name' => $this->role->name]),
            'invited_by_id' => $this->invited_by_id,
            'status' => $this->status,
            'expires_at' => $this->expires_at,
            'accepted_at' => $this->accepted_at,
            'created_at' => $this->created_at,
        ];
    }
}
