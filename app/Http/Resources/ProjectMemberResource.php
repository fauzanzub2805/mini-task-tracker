<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'user' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ]),
            'user_id' => $this->user_id,
            'role' => $this->whenLoaded('role', fn () => ['id' => $this->role->id, 'name' => $this->role->name]),
            'joined_at' => $this->joined_at,
        ];
    }
}
