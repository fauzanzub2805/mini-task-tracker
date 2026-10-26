<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\CommentAttachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class CommentAttachmentApiTest extends ApiTestCase
{
    /** PNG 1x1 valid agar deteksi tipe file oleh server menemukan image/png. */
    private const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

    public function test_comment_can_upload_multiple_files_and_mentions_at_once(): void
    {
        Storage::fake('local');

        $manager = $this->makeUser('manager');
        $member = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');
        $task = $this->makeTask($project, $manager);

        $this->actingAs($member)->post("/tasks/{$task->id}/comments", [
            'body' => 'notulen rapat @Fulan',
            'mention_ids' => [$manager->id],
            'files' => [
                UploadedFile::fake()->create('notulen.pdf', 120, 'application/pdf'),
                UploadedFile::fake()->create('catatan.txt', 2, 'text/plain'),
            ],
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonCount(2, 'data.attachments')
            ->assertJsonPath('data.body', 'notulen rapat @Fulan')
            ->assertJsonPath('data.attachments.0.name', 'notulen.pdf')
            ->assertJsonPath('data.attachments.1.name', 'catatan.txt')
            ->assertJsonStructure([
                'data' => ['attachments' => [['id', 'name', 'size', 'url', 'mime_type']]],
            ]);

        $comment = Comment::with('attachments')->firstOrFail();
        $this->assertCount(2, $comment->attachments);
        $this->assertSame([$manager->id], $comment->mentions()->pluck('users.id')->all());

        foreach ($comment->attachments as $attachment) {
            Storage::disk('local')->assertExists($attachment->path);
            $this->assertStringStartsWith("comment-attachments/{$comment->id}/", $attachment->path);
        }

        $this->assertSame(120 * 1024, (int) $comment->attachments[0]->size);
        $this->assertEquals($member->id, $comment->attachments[0]->uploaded_by_id);

        // Lampiran ikut terkirim saat komentar dimuat ulang.
        $this->actingAs($manager)->getJson("/tasks/{$task->id}/comments")->assertOk()
            ->assertJsonCount(2, 'data.0.attachments')
            ->assertJsonPath('data.0.attachments.0.name', 'notulen.pdf');
    }

    public function test_file_only_comment_is_allowed_while_empty_comment_is_rejected(): void
    {
        Storage::fake('local');

        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $task = $this->makeTask($project, $manager);

        $this->actingAs($manager)->post("/tasks/{$task->id}/comments", [
            'files' => [UploadedFile::fake()->create('bukti.pdf', 4, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.body', '')
            ->assertJsonCount(1, 'data.attachments');

        $this->assertSame(1, CommentAttachment::count());

        // Tanpa body dan tanpa file tetap ditolak.
        $this->postJson("/tasks/{$task->id}/comments", [])->assertUnprocessable()
            ->assertJsonValidationErrors('body');
        $this->postJson("/tasks/{$task->id}/comments", ['body' => '   '])->assertUnprocessable()
            ->assertJsonValidationErrors('body');
        $this->post("/tasks/{$task->id}/comments", ['files' => []], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('body');
    }

    public function test_json_comment_without_attachments_stays_backwards_compatible(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $task = $this->makeTask($project, $manager);

        $this->actingAs($manager)->postJson("/tasks/{$task->id}/comments", ['body' => 'komentar lama'])
            ->assertCreated()
            ->assertJsonPath('data.body', 'komentar lama')
            ->assertJsonPath('data.attachments', []);

        $this->assertSame(0, CommentAttachment::count());
    }

    public function test_each_comment_file_is_limited_to_ten_mib(): void
    {
        Storage::fake('local');

        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $task = $this->makeTask($project, $manager);

        $this->actingAs($manager)->post("/tasks/{$task->id}/comments", [
            'body' => 'batas',
            'files' => [UploadedFile::fake()->create('pas.pdf', 10240, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->post("/tasks/{$task->id}/comments", [
            'body' => 'terlalu besar',
            'files' => [UploadedFile::fake()->create('besar.pdf', 10241, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertUnprocessable()
            ->assertJsonValidationErrors('files.0');

        $this->assertSame(1, CommentAttachment::count());
    }

    public function test_downloads_are_private_and_scoped_to_the_comment(): void
    {
        Storage::fake('local');

        $manager = $this->makeUser('manager');
        $member = $this->makeUser('staff');
        $outsider = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');
        $task = $this->makeTask($project, $manager);
        $otherTask = $this->makeTask($project, $manager, ['title' => 'Task lain']);

        $this->actingAs($manager)->post("/tasks/{$task->id}/comments", [
            'body' => 'dengan lampiran',
            'files' => [UploadedFile::fake()->create('dokumen.pdf', 8, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated();

        $comment = Comment::firstOrFail();
        $attachment = CommentAttachment::firstOrFail();
        $url = "/tasks/{$task->id}/comments/{$comment->id}/attachments/{$attachment->id}";

        $this->actingAs($member)->get($url)->assertOk()
            ->assertHeader('Content-Disposition');
        $this->actingAs($outsider)->get($url)->assertForbidden();

        // Lampiran harus milik komentar pada URL dan komentar harus milik task.
        $otherComment = Comment::create([
            'task_id' => $task->id, 'author_id' => $manager->id, 'body' => 'komentar lain',
        ]);
        $this->actingAs($manager)->get("/tasks/{$task->id}/comments/{$otherComment->id}/attachments/{$attachment->id}")
            ->assertNotFound();
        $this->actingAs($manager)->get("/tasks/{$otherTask->id}/comments/{$comment->id}/attachments/{$attachment->id}")
            ->assertNotFound();
    }

    public function test_preview_serves_only_safe_raster_images_inline(): void
    {
        Storage::fake('local');

        $manager = $this->makeUser('manager');
        $member = $this->makeUser('staff');
        $outsider = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');
        $task = $this->makeTask($project, $manager);

        $this->actingAs($manager)->post("/tasks/{$task->id}/comments", [
            'body' => 'gambar',
            'files' => [
                UploadedFile::fake()->createWithContent('foto.png', base64_decode(self::PNG_1X1)),
                UploadedFile::fake()->createWithContent('palsu.png', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
            ],
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonPath('data.attachments.0.preview_url', fn ($url) => is_string($url) && str_ends_with($url, '/preview'));

        $comment = Comment::firstOrFail();
        [$image, $svg] = CommentAttachment::orderBy('id')->get()->all();

        $previewUrl = "/tasks/{$task->id}/comments/{$comment->id}/attachments/{$image->id}/preview";

        $this->actingAs($member)->get($previewUrl)->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringStartsWith('inline', (string) $this->get($previewUrl)->headers->get('Content-Disposition'));

        $this->actingAs($outsider)->get($previewUrl)->assertForbidden();

        // SVG (atau file yang diklaim gambar tapi isinya bukan raster aman) tidak boleh inline.
        $this->actingAs($manager)
            ->get("/tasks/{$task->id}/comments/{$comment->id}/attachments/{$svg->id}/preview")
            ->assertNotFound();

        // Endpoint unduh biasa tetap mengirim sebagai attachment.
        $this->actingAs($manager)
            ->get("/tasks/{$task->id}/comments/{$comment->id}/attachments/{$image->id}")
            ->assertOk()
            ->assertDownload('foto.png');
    }

    public function test_outsiders_cannot_attach_files_to_a_task_comment(): void
    {
        Storage::fake('local');

        $manager = $this->makeUser('manager');
        $outsider = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $task = $this->makeTask($project, $manager);

        $this->actingAs($outsider)->post("/tasks/{$task->id}/comments", [
            'body' => 'coba',
            'files' => [UploadedFile::fake()->create('x.pdf', 1, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertForbidden();

        $this->assertSame(0, CommentAttachment::count());
        $this->assertSame(0, Comment::count());
    }
}
