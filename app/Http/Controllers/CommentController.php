<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCommentRequest;
use App\Http\Resources\CommentResource;
use App\Models\Comment;
use App\Models\Task;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class CommentController extends Controller
{
    /** Relasi yang selalu dikirim agar UI bisa menampilkan lampiran komentar. */
    private const RELATIONS = ['author', 'mentions', 'attachments.comment'];

    public function __construct(private ActivityLogger $activities) {}

    /** Terlama ke terbaru. */
    public function index(Task $task)
    {
        Gate::authorize('view', $task);

        return CommentResource::collection(
            $task->comments()->with(self::RELATIONS)->orderBy('created_at')->orderBy('id')->paginate(25)
        );
    }

    public function store(StoreCommentRequest $request, Task $task): JsonResponse
    {
        Gate::authorize('create', [Comment::class, $task]);

        $comment = DB::transaction(function () use ($request, $task) {
            $comment = Comment::create([
                'task_id' => $task->id,
                'author_id' => $request->user()->id,
                // Komentar boleh hanya berisi file: body disimpan sebagai string kosong.
                'body' => trim((string) $request->input('body', '')),
            ]);

            // mention_ids bukan kolom komentar: disimpan di tabel comment_mentions.
            $comment->mentions()->sync($this->mentionIds($request->input('mention_ids', [])));

            // Lampiran terikat ke komentar ini (bukan ke task) di disk privat.
            foreach ($request->file('files', []) as $file) {
                $comment->attachments()->create([
                    'uploaded_by_id' => $request->user()->id,
                    'name' => $file->getClientOriginalName(),
                    'path' => $file->store('comment-attachments/'.$comment->id, 'local'),
                    'mime_type' => $file->getClientMimeType(),
                    'size' => (int) $file->getSize(),
                ]);
            }

            $this->activities->log($request->user(), $task->project_id, 'comment.created', 'menambahkan komentar', $task);

            return $comment;
        });

        return (new CommentResource($comment->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    /**
     * @param  mixed  $value
     * @return array<int, int>
     */
    private function mentionIds($value): array
    {
        $rows = is_array($value) ? $value : [];

        return collect($rows)
            ->filter(fn ($id) => $id !== null && $id !== '')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }
}
