<?php

namespace Tests\Feature;

use App\Models\Priority;
use App\Models\Task;
use App\Models\TaskAttachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

class ProjectsPageApiTest extends ApiTestCase
{
    public function test_manager_can_add_first_staff_by_role_name(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->actingAs($manager)->postJson("/projects/{$project->id}/members", [
            'user_id' => $staff->id, 'role' => 'staff',
        ])->assertCreated()->assertJsonPath('data.role.name', 'staff');
    }

    private function priorityId(string $name): int
    {
        return Priority::where('name', $name)->value('id');
    }

    public function test_all_five_task_statuses_are_accepted_and_unknown_status_rejected(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $this->actingAs($manager);

        foreach (Task::STATUSES as $status) {
            $this->postJson("/projects/{$project->id}/tasks", [
                'title' => "Task {$status}",
                'status' => $status,
            ])->assertCreated()->assertJsonPath('data.status', $status);
        }

        $this->assertSame(count(Task::STATUSES), $project->tasks()->distinct('status')->count('status'));

        $this->postJson("/projects/{$project->id}/tasks", ['title' => 'X', 'status' => 'blocked'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_priorities_include_urgent_and_task_sort_uses_priority_level(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $this->actingAs($manager);

        $this->getJson('/priorities')->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.name', 'low')
            ->assertJsonPath('data.1.name', 'medium')
            ->assertJsonPath('data.2.name', 'high')
            ->assertJsonPath('data.3.name', 'urgent')
            ->assertJsonPath('data.3.level', 4);

        $this->postJson("/projects/{$project->id}/tasks", [
            'title' => 'Biasa', 'priority_id' => $this->priorityId('low'),
        ])->assertCreated();
        $this->postJson("/projects/{$project->id}/tasks", [
            'title' => 'Mendesak', 'priority_id' => $this->priorityId('urgent'),
        ])->assertCreated()->assertJsonPath('data.priority.name', 'urgent');

        $this->getJson("/projects/{$project->id}/tasks?sort=priority&order=desc")->assertOk()
            ->assertJsonPath('data.0.title', 'Mendesak')
            ->assertJsonPath('data.0.priority.level', 4)
            ->assertJsonPath('data.1.title', 'Biasa');
    }

    public function test_manager_can_assign_multiple_project_members_but_staff_cannot(): void
    {
        $manager = $this->makeUser('manager');
        $staffA = $this->makeUser('staff');
        $staffB = $this->makeUser('staff');
        $outsider = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $staffA, 'staff');
        $this->join($project, $staffB, 'staff');

        $expected = [$staffA->id, $staffB->id];
        sort($expected);

        $this->actingAs($manager);
        $res = $this->postJson("/projects/{$project->id}/tasks", [
            'title' => 'Kolaborasi',
            'assignee_ids' => [$staffB->id, $staffA->id],
        ])->assertCreated()
            ->assertJsonCount(2, 'data.assignees')
            ->assertJsonPath('data.assignees.0.id', $expected[0])
            ->assertJsonPath('data.assignees.1.id', $expected[1])
            // Kolom assignee_id lama tetap diisi assignee pertama.
            ->assertJsonPath('data.assignee_id', $expected[0]);

        $taskId = $res->json('data.id');
        $this->assertSame(2, Task::findOrFail($taskId)->assignees()->count());

        // Filter assignee mencakup semua assignee, bukan hanya assignee utama.
        $this->getJson("/projects/{$project->id}/tasks?assignee_id={$staffB->id}")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $taskId);

        // Assignee harus anggota project.
        $this->postJson("/projects/{$project->id}/tasks", [
            'title' => 'Orang luar', 'assignee_ids' => [$outsider->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('assignee_ids.0');

        // Staff hanya boleh membuat task tanpa assignee.
        $staffTask = $this->actingAs($staffA)
            ->postJson("/projects/{$project->id}/tasks", ['title' => 'Tanpa assignee'])
            ->assertCreated()->assertJsonPath('data.assignee_id', null)
            ->json('data.id');

        $this->postJson("/projects/{$project->id}/tasks", [
            'title' => 'Nekat', 'assignee_ids' => [$staffA->id],
        ])->assertForbidden();

        // Staff boleh menyimpan ulang daftar assignee yang tidak berubah,
        // tetapi tidak boleh mengubahnya.
        $this->patchJson("/tasks/{$taskId}", [
            'title' => 'Kolaborasi v2', 'assignee_ids' => [$staffA->id, $staffB->id],
        ])->assertOk()->assertJsonPath('data.title', 'Kolaborasi v2');
        $this->patchJson("/tasks/{$taskId}", ['assignee_ids' => [$staffA->id]])->assertForbidden();
        $this->assertSame(2, Task::findOrFail($taskId)->assignees()->count());

        $this->assertNotSame($taskId, $staffTask);
    }

    public function test_global_manager_with_staff_project_role_cannot_assign_or_manage_members(): void
    {
        $owner = $this->makeUser('manager');
        $globalManager = $this->makeUser('manager');
        $outsider = $this->makeUser('staff');
        $project = $this->makeProject($owner);
        // Peran project menang atas peran global (lapis 2).
        $this->join($project, $globalManager, 'staff');

        $this->actingAs($globalManager);

        $this->postJson("/projects/{$project->id}/tasks", [
            'title' => 'Tidak boleh', 'assignee_ids' => [$globalManager->id],
        ])->assertForbidden();

        // Tanpa assignee, staff project tetap boleh membuat task.
        $taskId = $this->postJson("/projects/{$project->id}/tasks", ['title' => 'Boleh'])
            ->assertCreated()->json('data.id');

        // Hanya PM yang menetapkan assignee.
        $this->patchJson("/tasks/{$taskId}", ['assignee_ids' => [$globalManager->id]])->assertForbidden();

        $this->postJson("/projects/{$project->id}/members", [
            'user_id' => $outsider->id,
            'role_id' => Role::findByName('staff', 'web')->id,
        ])->assertForbidden();
        $this->deleteJson("/projects/{$project->id}/members/{$owner->id}")->assertForbidden();
        $this->patchJson("/projects/{$project->id}", ['name' => 'Ganti'])->assertForbidden();
    }

    public function test_comment_mentions_are_limited_to_project_members(): void
    {
        $manager = $this->makeUser('manager');
        $member = $this->makeUser('staff');
        $outsider = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');

        $foreignManager = $this->makeUser('manager');
        $foreignMember = $this->makeUser('staff');
        $foreignProject = $this->makeProject($foreignManager);
        $this->join($foreignProject, $foreignMember, 'staff');

        $task = $this->makeTask($project, $manager);

        $this->actingAs($member);
        $comment = $this->postJson("/tasks/{$task->id}/comments", [
            'body' => 'Halo @Manajer, mohon cek.',
            'mention_ids' => [$manager->id],
        ])->assertCreated()->assertJsonCount(1, 'data.mentions')->assertJsonPath('data.mentions.0.id', $manager->id);

        $this->assertSame(
            [$manager->id],
            $task->comments()->with('mentions')->findOrFail($comment->json('data.id'))->mentions->pluck('id')->all()
        );

        // Menyebut diri sendiri (anggota project) tetap sah.
        $this->postJson("/tasks/{$task->id}/comments", [
            'body' => 'Catatan saya.', 'mention_ids' => [$member->id],
        ])->assertCreated();

        $this->postJson("/tasks/{$task->id}/comments", [
            'body' => 'Halo orang luar.', 'mention_ids' => [$outsider->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('mention_ids.0');

        // Anggota project lain juga tidak boleh disebut.
        $this->postJson("/tasks/{$task->id}/comments", [
            'body' => 'Halo tetangga.', 'mention_ids' => [$foreignMember->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('mention_ids.0');

        $this->postJson("/tasks/{$task->id}/comments", [
            'body' => 'Duplikat.', 'mention_ids' => [$manager->id, $manager->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('mention_ids.1');
    }

    public function test_multi_file_attachments_limited_to_ten_mib_and_downloads_are_private(): void
    {
        Storage::fake('local');

        $manager = $this->makeUser('manager');
        $member = $this->makeUser('staff');
        $outsider = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');
        $task = $this->makeTask($project, $manager);

        $this->actingAs($manager);
        $this->post("/tasks/{$task->id}/attachments", [
            'files' => [
                UploadedFile::fake()->create('desain.pdf', 100, 'application/pdf'),
                UploadedFile::fake()->create('mockup.png', 250, 'image/png'),
            ],
        ], ['Accept' => 'application/json'])->assertCreated()
            ->assertJsonCount(2, 'data')
            ->assertJsonCount(2, 'attachments')
            ->assertJsonPath('data.0.name', 'desain.pdf')
            ->assertJsonPath('data.1.name', 'mockup.png')
            ->assertJsonStructure(['data' => [['id', 'name', 'size', 'mime_type', 'url', 'created_at']]]);

        $attachments = TaskAttachment::where('task_id', $task->id)->orderBy('id')->get();
        $this->assertCount(2, $attachments);
        foreach ($attachments as $attachment) {
            Storage::disk('local')->assertExists($attachment->path);
        }
        $this->assertSame(102400, $attachments[0]->size);

        // Batas 10 MiB per file: tepat 10 MiB lolos, lebih sedikit pun ditolak.
        $this->post("/tasks/{$task->id}/attachments", [
            'files' => [UploadedFile::fake()->create('batas.pdf', 10240, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated();

        $this->post("/tasks/{$task->id}/attachments", [
            'files' => [UploadedFile::fake()->create('besar.pdf', 10241, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertUnprocessable()
            ->assertJsonValidationErrors('files.0');

        $this->postJson("/tasks/{$task->id}/attachments", ['files' => []])
            ->assertUnprocessable()->assertJsonValidationErrors('files');

        // Unduhan hanya untuk user yang boleh melihat task.
        $url = "/tasks/{$task->id}/attachments/{$attachments[0]->id}";
        $this->actingAs($member)->get($url)->assertOk();
        $this->actingAs($outsider)->get($url)->assertForbidden();

        // Lampiran harus milik task pada URL.
        $otherTask = $this->makeTask($project, $manager, ['title' => 'Task lain']);
        $this->actingAs($manager)->get("/tasks/{$otherTask->id}/attachments/{$attachments[0]->id}")
            ->assertNotFound();
        $this->actingAs($outsider)->get("/tasks/{$task->id}/attachments/{$attachments[0]->id}")
            ->assertForbidden();
    }

    public function test_projects_page_and_task_detail_share_url_for_html_and_json(): void
    {
        $this->withoutVite();

        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $otherProject = $this->makeProject($manager);
        $task = $this->makeTask($project, $manager);
        $outsider = $this->makeUser('staff');

        $this->actingAs($manager);

        // /projects: HTML untuk navigasi browser, JSON tetap bawaan API.
        $this->get('/projects', ['Accept' => 'text/html'])->assertOk()->assertViewIs('dashboard');
        $this->getJson('/projects')->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonStructure(['data' => [['id', 'name', 'members_count', 'tasks_count', 'permissions']]]);
        $this->get("/projects/{$project->id}", ['Accept' => 'text/html'])->assertOk()->assertViewIs('dashboard');

        // /projects/{project}/tasks/{task}: task harus milik project pada URL.
        $taskUrl = "/projects/{$project->id}/tasks/{$task->id}";
        $this->get($taskUrl, ['Accept' => 'text/html'])->assertOk()->assertViewIs('dashboard');
        $this->getJson($taskUrl)->assertOk()->assertJsonPath('data.id', $task->id)
            ->assertJsonPath('data.project_id', $project->id);

        $this->get("/projects/{$otherProject->id}/tasks/{$task->id}", ['Accept' => 'text/html'])->assertNotFound();
        $this->getJson("/projects/{$otherProject->id}/tasks/{$task->id}")->assertNotFound();

        // Bukan anggota project: HTML dan JSON sama-sama ditolak.
        $this->actingAs($outsider);
        $this->get($taskUrl, ['Accept' => 'text/html'])->assertForbidden();
        $this->getJson($taskUrl)->assertForbidden();
    }
}
