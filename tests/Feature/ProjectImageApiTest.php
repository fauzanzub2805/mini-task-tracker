<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ProjectImageApiTest extends ApiTestCase
{
    public function test_upload_replace_remove_and_private_display(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $member = $this->makeUser();
        $outsider = $this->makeUser();
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');
        $endpoint = "/projects/{$project->id}";

        $this->actingAs($manager)->getJson($endpoint)->assertJsonPath('data.image_url', null);
        $this->get("{$endpoint}/image")->assertNotFound();
        $firstUrl = $this->post($endpoint, [
            '_method' => 'PATCH', 'name' => 'With image',
            'image' => UploadedFile::fake()->image('cover.jpg')->size(5120),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.name', 'With image')->json('data.image_url');
        $firstPath = $project->fresh()->image_path;
        Storage::disk('local')->assertExists($firstPath);
        $this->getJson($endpoint)->assertJsonPath('data.image_url', $firstUrl)->assertJsonMissingPath('data.image_path');
        $this->getJson('/projects')->assertJsonPath('data.0.image_url', $firstUrl);
        $this->actingAs($member)->get($firstUrl)->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->actingAs($outsider)->get($firstUrl)->assertForbidden();

        $secondUrl = $this->actingAs($manager)->post($endpoint, [
            '_method' => 'PATCH', 'image' => UploadedFile::fake()->image('replacement.png'),
        ], ['Accept' => 'application/json'])->assertOk()->json('data.image_url');
        $secondPath = $project->fresh()->image_path;
        $this->assertNotSame($firstUrl, $secondUrl);
        Storage::disk('local')->assertMissing($firstPath);
        Storage::disk('local')->assertExists($secondPath);
        $this->get($secondUrl)->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->patchJson($endpoint, ['description' => 'Keep image'])->assertOk()->assertJsonPath('data.image_url', $secondUrl);
        $this->patchJson($endpoint, ['remove_image' => true])->assertOk()->assertJsonPath('data.image_url', null);
        Storage::disk('local')->assertMissing($secondPath);
        $this->get($secondUrl)->assertNotFound();
        $this->patchJson($endpoint, ['remove_image' => true])->assertOk();
    }

    public function test_invalid_uploads_leave_existing_image_and_fields_unchanged(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $endpoint = "/projects/{$project->id}";
        $this->actingAs($manager)->post($endpoint, [
            '_method' => 'PATCH', 'image' => UploadedFile::fake()->image('cover.png'),
        ], ['Accept' => 'application/json'])->assertOk();
        $path = $project->fresh()->image_path;

        foreach ([
            UploadedFile::fake()->image('large.jpg')->size(5121),
            UploadedFile::fake()->image('animation.gif'),
            UploadedFile::fake()->image('unsupported.webp'),
            UploadedFile::fake()->createWithContent('spoof.jpg', '<html>not an image</html>')->mimeType('text/html'),
            UploadedFile::fake()->createWithContent('vector.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        ] as $image) {
            $this->post($endpoint, ['_method' => 'PATCH', 'name' => 'Invalid', 'image' => $image], ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('image');
        }
        $this->post($endpoint, ['_method' => 'PATCH', 'image' => UploadedFile::fake()->image('both.png'), 'remove_image' => '1'], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('image');
        $this->patchJson($endpoint, ['remove_image' => 'yes'])->assertUnprocessable()->assertJsonValidationErrors('remove_image');
        $this->assertSame($path, $project->fresh()->image_path);
        $this->assertSame('Proyek', $project->fresh()->name);
        $this->assertCount(1, Storage::disk('local')->allFiles());
    }

    public function test_upload_and_removal_require_project_update_permission(): void
    {
        Storage::fake('local');
        $owner = $this->makeUser('manager');
        $project = $this->makeProject($owner);
        $endpoint = "/projects/{$project->id}";
        $this->post($endpoint, ['_method' => 'PATCH', 'image' => UploadedFile::fake()->image('guest.png')], ['Accept' => 'application/json'])->assertUnauthorized();
        $this->getJson("{$endpoint}/image")->assertUnauthorized();
        $this->patchJson($endpoint, ['remove_image' => true])->assertUnauthorized();

        $staff = $this->makeUser();
        $globalManager = $this->makeUser('manager');
        $outsider = $this->makeUser('manager');
        $this->join($project, $staff, 'staff');
        $this->join($project, $globalManager, 'staff');
        foreach ([$staff, $globalManager, $outsider] as $user) {
            $this->actingAs($user)->post($endpoint, ['_method' => 'PATCH', 'image' => UploadedFile::fake()->image('denied.png')], ['Accept' => 'application/json'])->assertForbidden();
            $this->patchJson($endpoint, ['remove_image' => true])->assertForbidden();
        }
        $this->assertEmpty(Storage::disk('local')->allFiles());
        $this->actingAs($this->makeUser('admin'))->post($endpoint, ['_method' => 'PATCH', 'image' => UploadedFile::fake()->image('admin.png')], ['Accept' => 'application/json'])->assertOk();
    }

    public function test_project_deletion_cleans_image_only_when_deletion_succeeds(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $endpoint = "/projects/{$project->id}";
        $this->actingAs($manager)->post($endpoint, ['_method' => 'PATCH', 'image' => UploadedFile::fake()->image('cover.png')], ['Accept' => 'application/json'])->assertOk();
        $path = $project->fresh()->image_path;
        $task = $this->makeTask($project, $manager);
        $this->deleteJson($endpoint)->assertConflict();
        Storage::disk('local')->assertExists($path);
        $task->delete();
        $this->deleteJson($endpoint)->assertNoContent();
        Storage::disk('local')->assertMissing($path);
    }

    public function test_failed_database_update_cleans_new_file_and_preserves_previous_image(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $endpoint = "/projects/{$project->id}";
        $this->actingAs($manager)->post($endpoint, ['_method' => 'PATCH', 'image' => UploadedFile::fake()->image('cover.png')], ['Accept' => 'application/json'])->assertOk();
        $path = $project->fresh()->image_path;
        Project::updating(function () {
            throw new \RuntimeException('Simulated failure');
        });
        $this->post($endpoint, ['_method' => 'PATCH', 'image' => UploadedFile::fake()->image('replacement.png')], ['Accept' => 'application/json'])->assertStatus(500);
        $this->assertSame($path, $project->fresh()->image_path);
        Storage::disk('local')->assertExists($path);
        $this->assertCount(1, Storage::disk('local')->allFiles());
    }
}
