<?php

namespace Tests\Feature;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Foto task: ditambahkan saat membuat task, terpisah dari lampiran, dan
 * disajikan lewat route privat dengan kebijakan view yang sama.
 */
class TaskImageTest extends ApiTestCase
{
    public function test_create_task_with_photo_stores_it_and_exposes_image_url(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);

        $response = $this->actingAs($manager)->post("/projects/{$project->id}/tasks", [
            'title' => 'Final Recap Reimburse',
            'image' => UploadedFile::fake()->image('cover.jpg'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->assertNotNull($response->json('data.image_url'));
        $taskId = $response->json('data.id');
        $this->assertNotNull($this->freshImagePath($taskId));
        Storage::disk('local')->assertExists($this->freshImagePath($taskId));
    }

    public function test_create_task_without_photo_has_null_image_url(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);

        $this->actingAs($manager)->post("/projects/{$project->id}/tasks", [
            'title' => 'Tanpa Foto',
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.image_url', null);
    }

    public function test_rejects_non_image_photo(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);

        $this->actingAs($manager)->post("/projects/{$project->id}/tasks", [
            'title' => 'Berkas Salah',
            'image' => UploadedFile::fake()->create('note.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('image');
    }

    public function test_photo_route_serves_members_and_forbids_outsiders(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $task = $this->actingAs($manager)->post("/projects/{$project->id}/tasks", [
            'title' => 'Dengan Foto',
            'image' => UploadedFile::fake()->image('cover.png'),
        ], ['Accept' => 'application/json'])->json('data.id');

        // Anggota project boleh melihat foto.
        $this->actingAs($manager)->get("/tasks/{$task}/image")->assertOk();

        // Bukan anggota (dan bukan admin) ditolak, sama seperti detail task.
        $outsider = $this->makeUser('staff');
        $this->actingAs($outsider)->get("/tasks/{$task}/image")->assertForbidden();
    }

    private function freshImagePath(int $taskId): ?string
    {
        return \App\Models\Task::findOrFail($taskId)->image_path;
    }
}
