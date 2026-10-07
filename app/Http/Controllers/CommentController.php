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
    public function __construct(private ActivityLogger $activities) {}

    /** Terlama ke terbaru. */
    public function index(Task $task)
    {
        Gate::authorize('view', $task);

        return CommentResource::collection(
            $task->comments()->with('author')->orderBy('created_at')->orderBy('id')->paginate(25)
        );
    }

    public function store(StoreCommentRequest $request, Task $task): JsonResponse
    {
        Gate::authorize('create', [Comment::class, $task]);

        $comment = DB::transaction(function () use ($request, $task) {
            $comment = Comment::create([
                'task_id' => $task->id,
                'author_id' => $request->user()->id,
                'body' => $request->body,
            ]);

            $this->activities->log($request->user(), $task->project_id, 'comment.created', 'menambahkan komentar', $task);

            return $comment;
        });

        return (new CommentResource($comment->load('author')))->response()->setStatusCode(201);
    }
}
