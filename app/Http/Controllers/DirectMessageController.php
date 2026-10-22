<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreDirectMessageRequest;
use App\Http\Resources\DirectMessageResource;
use App\Models\DirectMessage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class DirectMessageController extends Controller
{
    /**
     * Cari pengguna lain (bukan diri sendiri) berdasarkan nama.
     * Dipakai kolom pencarian pada halaman Profile > Message.
     */
    public function users(Request $request): JsonResponse
    {
        $query = User::query()->whereKeyNot($request->user()->id);
        $search = trim((string) $request->query('q', ''));

        if ($search !== '') {
            $query->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%']);
        }

        $users = $query->orderBy('name')->orderBy('id')->limit(50)->get(['id', 'name'])
            ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name])
            ->values()
            ->all();

        return response()->json(['data' => $users]);
    }

    /**
     * Daftar percakapan milik pengguna, terbaru lebih dulu.
     *
     * Status indikator:
     * - unread (hijau): ada pesan masuk yang belum dibaca.
     * - awaiting_reply (merah): pesan terakhir adalah pesan masuk yang sudah dibaca.
     */
    public function conversations(Request $request): JsonResponse
    {
        $user = $request->user();

        $messages = DirectMessage::query()
            ->where(fn ($query) => $query->where('sender_id', $user->id)->orWhere('recipient_id', $user->id))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        $latestByPartner = [];
        $unreadByPartner = [];
        $bodyMatches = [];

        foreach ($messages as $message) {
            $partnerId = $message->sender_id === $user->id ? $message->recipient_id : $message->sender_id;

            $latestByPartner[$partnerId] ??= $message;

            if ($message->recipient_id === $user->id && $message->read_at === null) {
                $unreadByPartner[$partnerId] = ($unreadByPartner[$partnerId] ?? 0) + 1;
            }
        }

        $needle = mb_strtolower(trim((string) $request->query('q', '')));

        if ($needle !== '') {
            foreach ($messages as $message) {
                if ($message->body !== null && str_contains(mb_strtolower($message->body), $needle)) {
                    $partnerId = $message->sender_id === $user->id ? $message->recipient_id : $message->sender_id;
                    $bodyMatches[$partnerId] = true;
                }
            }
        }

        $partners = User::query()
            ->whereIn('id', array_keys($latestByPartner))
            ->get(['id', 'name'])
            ->keyBy('id');

        $conversations = [];

        foreach ($latestByPartner as $partnerId => $latest) {
            $partner = $partners->get($partnerId);

            if ($partner === null) {
                continue;
            }

            if ($needle !== '') {
                $nameMatches = str_contains(mb_strtolower($partner->name), $needle);
                $messageMatches = $bodyMatches[$partnerId] ?? false;

                if (! $nameMatches && ! $messageMatches) {
                    continue;
                }
            }

            $unreadCount = $unreadByPartner[$partnerId] ?? 0;
            $latestIsIncoming = $latest->recipient_id === $user->id;

            $status = match (true) {
                $unreadCount > 0 => 'unread',
                $latestIsIncoming && $latest->read_at !== null => 'awaiting_reply',
                default => null,
            };

            $conversations[] = [
                'user' => ['id' => $partner->id, 'name' => $partner->name],
                'last_message' => $latest->body ?? $latest->attachment_name,
                'last_message_at' => $latest->created_at?->toIso8601String(),
                'unread_count' => $unreadCount,
                'status' => $status,
            ];
        }

        return response()->json([
            'data' => $conversations,
            'unread_count' => $this->unreadTotal($user),
        ]);
    }

    /**
     * 100 pesan terakhir antara pengguna yang login dan pengguna lain,
     * diurutkan kronologis (lama ke baru).
     */
    public function messages(Request $request, User $user): AnonymousResourceCollection
    {
        $auth = $request->user();
        $this->ensureNotSelf($auth, $user);

        $messages = $this->conversationQuery($auth->id, $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->reverse()
            ->values();

        return DirectMessageResource::collection($messages);
    }

    public function store(StoreDirectMessageRequest $request, User $user): JsonResponse
    {
        $auth = $request->user();
        $this->ensureNotSelf($auth, $user);

        $file = $request->file('attachment');
        $path = $file?->store('direct-messages/'.$auth->id, 'local');

        $message = DirectMessage::create([
            'sender_id' => $auth->id,
            'recipient_id' => $user->id,
            'body' => trim((string) $request->input('body', '')) !== ''
                ? $request->input('body')
                : null,
            'attachment_path' => $path,
            'attachment_name' => $file?->getClientOriginalName(),
            'attachment_mime' => $file?->getClientMimeType(),
            'attachment_size' => $file?->getSize(),
        ]);

        return (new DirectMessageResource($message->fresh()))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED);
    }

    /**
     * Tandai pesan masuk sebagai dibaca hanya sampai id tertentu.
     * `through_id` mencegah pesan baru yang belum terlihat ikut terbaca
     * ketika ada pesan masuk di antara permintaan dan respons.
     */
    public function read(Request $request, User $user): JsonResponse
    {
        $auth = $request->user();
        $this->ensureNotSelf($auth, $user);

        $data = $request->validate([
            'through_id' => ['required', 'integer', 'min:1'],
        ]);

        $updated = DirectMessage::query()
            ->where('recipient_id', $auth->id)
            ->where('sender_id', $user->id)
            ->whereNull('read_at')
            ->where('id', '<=', $data['through_id'])
            ->update(['read_at' => now()]);

        $unreadInConversation = DirectMessage::query()
            ->where('recipient_id', $auth->id)
            ->where('sender_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'data' => [
                'updated' => $updated,
                'unread_count' => $unreadInConversation,
            ],
            'unread_count' => $this->unreadTotal($auth),
        ]);
    }

    public function destroy(Request $request, DirectMessage $message): Response
    {
        abort_unless($message->sender_id === $request->user()->id, Response::HTTP_FORBIDDEN);

        if ($message->hasAttachment()) {
            Storage::disk('local')->delete($message->attachment_path);
        }

        $message->delete();

        return response()->noContent();
    }

    /** Unduh lampiran privat; hanya peserta percakapan yang boleh. */
    public function attachment(Request $request, DirectMessage $message)
    {
        abort_unless($message->isParticipant($request->user()->id), Response::HTTP_FORBIDDEN);
        abort_unless($message->hasAttachment(), Response::HTTP_NOT_FOUND);

        $disk = Storage::disk('local');

        abort_unless($disk->exists($message->attachment_path), Response::HTTP_NOT_FOUND);

        return $disk->download(
            $message->attachment_path,
            $message->attachment_name ?? basename($message->attachment_path),
        );
    }

    private function conversationQuery(int $authId, int $partnerId)
    {
        return DirectMessage::query()->where(function ($query) use ($authId, $partnerId) {
            $query->where(fn ($pair) => $pair->where('sender_id', $authId)->where('recipient_id', $partnerId))
                ->orWhere(fn ($pair) => $pair->where('sender_id', $partnerId)->where('recipient_id', $authId));
        });
    }

    private function ensureNotSelf(User $auth, User $user): void
    {
        abort_if($auth->id === $user->id, Response::HTTP_UNPROCESSABLE_ENTITY, 'Tidak dapat memulai percakapan dengan diri sendiri.');
    }

    private function unreadTotal(User $user): int
    {
        return DirectMessage::query()
            ->where('recipient_id', $user->id)
            ->whereNull('read_at')
            ->count();
    }
}
