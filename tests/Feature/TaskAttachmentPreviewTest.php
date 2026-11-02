<?php

namespace Tests\Feature;

use App\Models\TaskAttachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class TaskAttachmentPreviewTest extends ApiTestCase
{
    public function test_upload_returns_preview_and_download_urls_and_serves_images_inline(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $task = $this->makeTask($this->makeProject($manager), $manager);
        $response = $this->actingAs($manager)->post("/tasks/{$task->id}/attachments", [
            'files' => [UploadedFile::fake()->image('cover.png')],
        ], ['Accept' => 'application/json'])->assertCreated();
        $preview = $response->json('data.0.preview_url');
        $download = $response->json('data.0.url');
        $this->assertStringEndsWith('/preview', $preview);
        $this->getJson("/tasks/{$task->id}")->assertJsonPath('data.attachments.0.preview_url', $preview);
        $result = $this->get($preview)->assertOk()->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringStartsWith('inline;', $result->headers->get('Content-Disposition'));
        $this->assertStringContainsString('sandbox', $result->headers->get('Content-Security-Policy'));
        $this->assertStringContainsString('no-store', $result->headers->get('Cache-Control'));
        $result = $this->get($download)->assertOk();
        $this->assertStringStartsWith('attachment;', $result->headers->get('Content-Disposition'));
    }

    public function test_pdf_and_plain_text_preview_but_active_content_and_archives_have_a_safe_fallback(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $task = $this->makeTask($this->makeProject($manager), $manager);
        $this->actingAs($manager);
        foreach ([
            ['brief.pdf', "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF", 'application/pdf'],
            ['notes.txt', 'Ordinary plain text notes.', 'text/plain; charset=UTF-8'],
            ['unsafe.html', '<!DOCTYPE html><html><script>alert(1)</script></html>', null],
            ['unsafe.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', null],
            ['archive.zip', "PK\x03\x04".str_repeat("\x00", 100), null],
        ] as [$name, $contents, $expectedType]) {
            Storage::disk('local')->put($name, $contents);
            // Deliberately misleading metadata: preview must inspect the real bytes.
            $attachment = $task->attachments()->create([
                'uploaded_by_id' => $manager->id, 'name' => $name, 'path' => $name,
                'mime_type' => 'image/png', 'size' => strlen($contents),
            ]);
            $response = $this->get("/tasks/{$task->id}/attachments/{$attachment->id}/preview")->assertOk();
            if ($expectedType) {
                $response->assertHeader('Content-Type', $expectedType);
                $this->assertStringStartsWith('inline;', $response->headers->get('Content-Disposition'));
            } else {
                $response->assertSee('Preview tidak tersedia')->assertSee("Download {$name}")
                    ->assertDontSee('<script>', false);
                $this->assertNull($response->headers->get('Content-Disposition'));
            }
        }
    }

    public function test_preview_requires_membership_correct_task_and_an_existing_file(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $task = $this->makeTask($project, $manager);
        $otherTask = $this->makeTask($project, $manager);
        $member = $this->makeUser();
        $this->join($project, $member, 'staff');
        $this->actingAs($manager)->post("/tasks/{$task->id}/attachments", [
            'files' => [UploadedFile::fake()->image('cover.jpg')],
        ], ['Accept' => 'application/json'])->assertCreated();
        $attachment = TaskAttachment::firstOrFail();
        $url = "/tasks/{$task->id}/attachments/{$attachment->id}/preview";
        $this->actingAs($member)->get($url)->assertOk();
        $this->get("/tasks/{$otherTask->id}/attachments/{$attachment->id}/preview")->assertNotFound();
        $this->actingAs($this->makeUser())->get($url)->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->getJson($url)->assertUnauthorized();
        Storage::disk('local')->delete($attachment->path);
        $this->actingAs($manager)->get($url)->assertNotFound();
    }
}
