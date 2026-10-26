<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\CommentAttachment;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

/**
 * Akses lampiran komentar. File berada di disk privat dan hanya bisa diunduh
 * user yang boleh melihat task pemilik komentar. Lampiran juga harus benar
 * milik komentar pada URL agar tidak bisa ditebak lewat id.
 */
class CommentAttachmentController extends Controller
{
    /** Hanya raster aman yang boleh disajikan inline untuk pratinjau. */
    private const PREVIEW_MIME_TYPES = [
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
    ];

    /** Unduh sebagai attachment (Content-Disposition: attachment). */
    public function download(Task $task, Comment $comment, CommentAttachment $attachment)
    {
        $this->authorizeAttachment($task, $comment, $attachment);

        $disk = Storage::disk('local');

        abort_unless($disk->exists($attachment->path), Response::HTTP_NOT_FOUND);

        return $disk->download($attachment->path, $attachment->name);
    }

    /**
     * Pratinjau inline untuk gambar. Tipe file dideteksi ulang dari isi file;
     * SVG/HTML/tipe lain tetap ditolak agar tidak dieksekusi sebagai halaman.
     */
    public function preview(Request $request, Task $task, Comment $comment, CommentAttachment $attachment)
    {
        $this->authorizeAttachment($task, $comment, $attachment);

        $disk = Storage::disk('local');

        abort_unless($disk->exists($attachment->path), Response::HTTP_NOT_FOUND);

        $path = $disk->path($attachment->path);
        $mime = $this->detectMimeType($path);

        abort_unless(in_array($mime, self::PREVIEW_MIME_TYPES, true), Response::HTTP_NOT_FOUND);

        return response()->file($path, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="'.$this->safeFilename($attachment->name).'"',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'",
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }

    private function authorizeAttachment(Task $task, Comment $comment, CommentAttachment $attachment): void
    {
        abort_unless((int) $comment->task_id === (int) $task->id, Response::HTTP_NOT_FOUND);
        abort_unless((int) $attachment->comment_id === (int) $comment->id, Response::HTTP_NOT_FOUND);

        Gate::authorize('view', $task);
    }

    private function detectMimeType(string $path): string
    {
        if (! function_exists('finfo_open')) {
            return 'application/octet-stream';
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);

        if ($finfo === false) {
            return 'application/octet-stream';
        }

        $detected = finfo_file($finfo, $path);
        finfo_close($finfo);

        return is_string($detected) ? strtolower($detected) : 'application/octet-stream';
    }

    private function safeFilename(string $name): string
    {
        return str_replace(['"', '\\', "\r", "\n"], '', basename($name));
    }
}
