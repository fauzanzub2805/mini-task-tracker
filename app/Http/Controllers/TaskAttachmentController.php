<?php

namespace App\Http\Controllers;

use App\Http\Resources\TaskAttachmentResource;
use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

/**
 * Lampiran privat task (maks 10 MiB per file). File disimpan pada disk
 * "local" (storage/app/private); akses selalu lewat endpoint unduh yang
 * memeriksa izin view task.
 */
class TaskAttachmentController extends Controller
{
    /** 10 MiB dalam kilobyte, sesuai batas UI (docs/progress/frontend-projects.md). */
    private const MAX_KILOBYTES = 10240;

    /** Unggah satu atau banyak file sekaligus (field `files[]`). */
    public function store(Request $request, Task $task): JsonResponse
    {
        Gate::authorize('update', $task);

        $request->validate([
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['required', 'file', 'max:'.self::MAX_KILOBYTES],
        ], [
            'files.required' => 'Pilih minimal satu file.',
            'files.*.max' => 'Ukuran setiap file maksimal 10 MB.',
            'files.*.file' => 'Berkas yang diunggah tidak valid.',
        ]);

        $created = DB::transaction(function () use ($request, $task) {
            $rows = [];

            foreach ($request->file('files', []) as $file) {
                $path = $file->store('task-attachments/'.$task->id, 'local');

                $rows[] = $task->attachments()->create([
                    'uploaded_by_id' => $request->user()->id,
                    'name' => $file->getClientOriginalName(),
                    'path' => $path,
                    'mime_type' => $file->getClientMimeType(),
                    'size' => (int) $file->getSize(),
                ]);
            }

            return $rows;
        });

        // Daftar yang sama dikirim sebagai `data` (bentuk resource Laravel)
        // sekaligus `attachments` agar widget unggah bisa memakainya langsung.
        $data = TaskAttachmentResource::collection($created)->resolve($request);

        return response()->json(['data' => $data, 'attachments' => $data], Response::HTTP_CREATED);
    }

    /** Unduh lampiran; hanya user yang boleh melihat task terkait. */
    public function download(Request $request, Task $task, TaskAttachment $attachment)
    {
        abort_unless((int) $attachment->task_id === (int) $task->id, Response::HTTP_NOT_FOUND);

        Gate::authorize('view', $task);

        $disk = Storage::disk('local');

        abort_unless($disk->exists($attachment->path), Response::HTTP_NOT_FOUND);

        return $disk->download($attachment->path, $attachment->name);
    }

    /** Preview only safe content types; never trust the uploaded MIME claim. */
    public function preview(Task $task, TaskAttachment $attachment)
    {
        abort_unless((int) $attachment->task_id === (int) $task->id, Response::HTTP_NOT_FOUND);
        Gate::authorize('view', $task);

        $disk = Storage::disk('local');
        abort_unless($disk->exists($attachment->path), Response::HTTP_NOT_FOUND);
        $mime = $disk->mimeType($attachment->path);
        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "sandbox; default-src 'none'; frame-ancestors 'none'",
            'Cache-Control' => 'private, no-store, max-age=0',
        ];

        if (! in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'], true)) {
            return response()->view('task-attachment-preview', [
                'attachment' => $attachment,
                'downloadUrl' => route('tasks.attachments.download', ['task' => $task->id, 'attachment' => $attachment->id]),
            ], 200, array_merge($headers, [
                'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
            ]));
        }

        $response = response()->file($disk->path($attachment->path), array_merge($headers, [
            'Content-Type' => $mime === 'text/plain' ? 'text/plain; charset=UTF-8' : $mime,
        ]));
        $response->setContentDisposition('inline', $attachment->name);

        return $response;
    }

    public function destroy(Task $task, TaskAttachment $attachment): Response
    {
        abort_unless((int) $attachment->task_id === (int) $task->id, Response::HTTP_NOT_FOUND);

        Gate::authorize('update', $task);

        Storage::disk('local')->delete($attachment->path);
        $attachment->delete();

        return response()->noContent();
    }
}
