<?php

namespace Tests\Feature;

use App\Models\TaskAttachment;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Pemisahan Instructions File vs Submitted Files dan aturan hapusnya:
 * hanya Admin Sistem dan Project Manager yang boleh menghapus berkas kumpulan
 * (Submitted Files); Staff tidak.
 */
class TaskSubmittedFilesTest extends ApiTestCase
{
    private function submission(\App\Models\Task $task, User $uploader): TaskAttachment
    {
        return $task->attachments()->create([
            'uploaded_by_id' => $uploader->id,
            'kind' => TaskAttachment::KIND_SUBMISSION,
            'name' => 'hasil.png',
            'path' => 'hasil.png',
            'mime_type' => 'image/png',
            'size' => 2048,
        ]);
    }

    public function test_upload_defaults_to_instruction_kind(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $task = $this->makeTask($this->makeProject($manager), $manager);

        $this->actingAs($manager)
            ->post("/tasks/{$task->id}/attachments", [
                'files' => [UploadedFile::fake()->create('brief.pdf', 10)],
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.0.kind', TaskAttachment::KIND_INSTRUCTION);
    }

    public function test_staff_can_submit_files_and_response_names_the_sender(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $staff = $this->makeUser('staff');
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager);

        $this->actingAs($staff)
            ->post("/tasks/{$task->id}/attachments", [
                'files' => [UploadedFile::fake()->image('hasil.png')],
                'kind' => TaskAttachment::KIND_SUBMISSION,
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('data.0.kind', TaskAttachment::KIND_SUBMISSION)
            ->assertJsonPath('data.0.uploaded_by.name', $staff->name);
    }

    public function test_staff_cannot_delete_a_submitted_file(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $staff = $this->makeUser('staff');
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager);
        $attachment = $this->submission($task, $staff);

        $this->actingAs($staff)
            ->deleteJson("/tasks/{$task->id}/attachments/{$attachment->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('task_attachments', ['id' => $attachment->id]);
    }

    public function test_project_manager_can_delete_a_submitted_file(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $staff = $this->makeUser('staff');
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager);
        $attachment = $this->submission($task, $staff);

        $this->actingAs($manager)
            ->deleteJson("/tasks/{$task->id}/attachments/{$attachment->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('task_attachments', ['id' => $attachment->id]);
    }

    public function test_admin_sistem_can_delete_a_submitted_file(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $staff = $this->makeUser('staff');
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager);
        $attachment = $this->submission($task, $staff);

        // Admin global melewati pemeriksaan lapis 2 (Gate::before), tanpa perlu
        // menjadi anggota project.
        $admin = $this->makeUser('admin');

        $this->actingAs($admin)
            ->deleteJson("/tasks/{$task->id}/attachments/{$attachment->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('task_attachments', ['id' => $attachment->id]);
    }

    public function test_staff_may_still_delete_instruction_files(): void
    {
        Storage::fake('local');
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $staff = $this->makeUser('staff');
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager);
        $instruction = $task->attachments()->create([
            'uploaded_by_id' => $manager->id,
            'kind' => TaskAttachment::KIND_INSTRUCTION,
            'name' => 'brief.pdf',
            'path' => 'brief.pdf',
            'mime_type' => 'application/pdf',
            'size' => 1024,
        ]);

        // Berkas instruksi tetap mengikuti izin task.update (Staff memilikinya).
        $this->actingAs($staff)
            ->deleteJson("/tasks/{$task->id}/attachments/{$instruction->id}")
            ->assertNoContent();
    }

    public function test_task_resource_exposes_can_flags_per_role(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $staff = $this->makeUser('staff');
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager);

        $this->actingAs($manager)->getJson("/tasks/{$task->id}")
            ->assertOk()->assertJsonPath('data.can.delete', true);

        $this->actingAs($staff)->getJson("/tasks/{$task->id}")
            ->assertOk()->assertJsonPath('data.can.delete', false);
    }
}
