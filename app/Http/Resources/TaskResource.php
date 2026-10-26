<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'project' => $this->whenLoaded('project', fn () => [
                'id' => $this->project->id,
                'name' => $this->project->name,
            ]),
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status,
            'priority' => $this->whenLoaded('priority', fn () => new PriorityResource($this->priority)),
            'priority_id' => $this->priority_id,
            'due_date' => $this->due_date?->toDateString(),
            // Assignee utama (kolom lama) tetap dikirim untuk kompatibilitas.
            'assignee_id' => $this->assignee_id,
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee ? [
                'id' => $this->assignee->id,
                'name' => $this->assignee->name,
            ] : null),
            'assignees' => $this->whenLoaded('assignees', fn () => $this->assignees
                ->map(fn ($user) => ['id' => $user->id, 'name' => $user->name])
                ->values()
                ->all()),
            'attachments' => TaskAttachmentResource::collection($this->whenLoaded('attachments')),
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
            ] : null),
            'created_by_id' => $this->created_by_id,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
