<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request, NotificationService $notifications)
    {
        $data = $request->validate(['before_id' => ['nullable', 'integer', 'min:1']]);
        $notifications->refreshDeadlines($request->user());
        $query = AppNotification::visibleTo($request->user());
        $through = (clone $query)->max('id') ?? 0;
        $unread = (clone $query)->whereNull('read_at')->count();
        $rows = $query->when($data['before_id'] ?? null, fn ($q, $id) => $q->where('id', '<', $id))
            ->orderByDesc('id')->limit(21)->get();
        $more = $rows->count() > 20;
        $rows = $rows->take(20);

        return response()->json([
            'data' => $rows->map(fn ($row) => [
                'id' => $row->id, 'recipientId' => $row->user_id, 'type' => $row->type,
                'title' => $row->title, 'body' => $row->body, 'url' => $row->url,
                'readAt' => $row->read_at?->toIso8601String(), 'createdAt' => $row->created_at->toIso8601String(),
            ])->values(),
            'unread_count' => $unread,
            'next_before_id' => $more ? $rows->last()->id : null,
            'through_id' => $through,
            'timezone' => config('notifications.timezone'),
            'today' => now(config('notifications.timezone'))->toDateString(),
        ]);
    }

    public function read(Request $request, int $id)
    {
        $notification = AppNotification::visibleTo($request->user())->findOrFail($id);
        if (! $notification->read_at) {
            $notification->update(['read_at' => now()]);
        }

        return response()->noContent();
    }

    public function readAll(Request $request)
    {
        $data = $request->validate(['through_id' => ['required', 'integer', 'min:0']]);
        AppNotification::visibleTo($request->user())->where('id', '<=', $data['through_id'])
            ->whereNull('read_at')->update(['read_at' => now()]);

        return response()->noContent();
    }
}
