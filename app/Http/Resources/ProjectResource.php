<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Gate;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'created_by_id' => $this->created_by_id,
            'members_count' => $this->whenCounted('members'),
            'tasks_count' => $this->whenCounted('tasks'),
            // Dinilai langsung dari ProjectPolicy (lapis 2) agar UI tidak perlu
            // menebak dari peran global pengguna.
            'permissions' => $user ? [
                'view' => Gate::forUser($user)->allows('view', $this->resource),
                'update' => Gate::forUser($user)->allows('update', $this->resource),
                'delete' => Gate::forUser($user)->allows('delete', $this->resource),
                'manageMembers' => Gate::forUser($user)->allows('manageMembers', $this->resource),
                'viewActivities' => Gate::forUser($user)->allows('viewActivities', $this->resource),
            ] : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
