<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class CreateProjectImageTest extends ApiTestCase
{
    public function test_creates_project_with_each_supported_image_type_at_the_size_limit(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $this->actingAs($manager);

        foreach (['jpg', 'jpeg', 'png'] as $extension) {
            $response = $this->post('/projects', [
                'name' => 'New project', 'description' => 'With cover',
                'image' => UploadedFile::fake()->image("cover.{$extension}")->size(5120),
            ], ['Accept' => 'application/json'])->assertCreated()
                ->assertJsonPath('data.name', 'New project')
                ->assertJsonPath('data.description', 'With cover')
                ->assertJsonMissingPath('data.image_path');
            $project = Project::findOrFail($response->json('data.id'));
            Storage::disk('local')->assertExists($project->image_path);
            $this->assertDatabaseHas('project_members', ['project_id' => $project->id, 'user_id' => $manager->id]);
            $this->get($response->json('data.image_url'))->assertOk()
                ->assertHeader('Content-Type', $extension === 'png' ? 'image/png' : 'image/jpeg');
            $this->getJson('/projects')->assertJsonPath('data.0.image_url', $response->json('data.image_url'));
        }
    }

    public function test_image_is_optional(): void
    {
        Storage::fake('local');
        $this->actingAs($this->makeUser('manager'))->postJson('/projects', ['name' => 'No image'])
            ->assertCreated()->assertJsonPath('data.image_url', null);
        $this->assertEmpty(Storage::disk('local')->allFiles());
    }

    public function test_invalid_uploads_do_not_create_projects_or_files(): void
    {
        Storage::fake('local');
        $this->actingAs($this->makeUser('manager'));
        foreach ([
            UploadedFile::fake()->image('large.jpg')->size(5121),
            UploadedFile::fake()->image('animation.gif'),
            UploadedFile::fake()->image('unsupported.webp'),
            UploadedFile::fake()->createWithContent('fake.jpg', '<html>not an image</html>')->mimeType('text/html'),
            UploadedFile::fake()->createWithContent('vector.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        ] as $image) {
            $this->post('/projects', ['name' => 'Invalid', 'image' => $image], ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('image');
        }
        $this->assertDatabaseCount('projects', 0);
        $this->assertEmpty(Storage::disk('local')->allFiles());
    }

    public function test_upload_cannot_bypass_create_permission(): void
    {
        Storage::fake('local');
        $this->post('/projects', ['name' => 'Guest', 'image' => UploadedFile::fake()->image('cover.png')], ['Accept' => 'application/json'])
            ->assertUnauthorized();
        $this->actingAs($this->makeUser())->post('/projects', ['name' => 'Staff', 'image' => UploadedFile::fake()->image('cover.png')], ['Accept' => 'application/json'])
            ->assertForbidden();
        $this->assertDatabaseCount('projects', 0);
        $this->assertEmpty(Storage::disk('local')->allFiles());
    }

    public function test_creation_failure_rolls_back_project_and_cleans_uploaded_file(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        ProjectMember::creating(function () {
            throw new \RuntimeException('Simulated membership failure');
        });
        $this->actingAs($manager)->post('/projects', [
            'name' => 'Rollback', 'image' => UploadedFile::fake()->image('cover.png'),
        ], ['Accept' => 'application/json'])->assertStatus(500);
        $this->assertDatabaseCount('projects', 0);
        $this->assertDatabaseCount('project_members', 0);
        $this->assertEmpty(Storage::disk('local')->allFiles());
    }
}
