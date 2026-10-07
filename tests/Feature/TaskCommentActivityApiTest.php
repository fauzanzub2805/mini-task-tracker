<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Priority;
use App\Models\Task;

class TaskCommentActivityApiTest extends ApiTestCase
{
    public function test_create_task_defaults_to_medium_todo_and_logs_activity(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);

        $res = $this->actingAs($manager)->postJson("/projects/{$project->id}/tasks", ['title' => 'Satu'])->assertCreated();

        $res->assertJsonPath('data.status', 'todo')->assertJsonPath('data.priority.name', 'medium');
        $this->assertSame(1, Activity::where('action', 'task.created')->where('task_id', $res->json('data.id'))->count());
        $this->postJson("/projects/{$project->id}/tasks", [])->assertUnprocessable();
        $this->postJson("/projects/{$project->id}/tasks", ['title' => 'X', 'status' => 'bogus'])->assertUnprocessable();
    }

    public function test_assignee_must_be_project_member(): void
    {
        $manager = $this->makeUser('manager');
        $outsider = $this->makeUser('staff');
        $member = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');

        $this->actingAs($manager)->postJson("/projects/{$project->id}/tasks", ['title' => 'T', 'assignee_id' => $outsider->id])->assertUnprocessable();
        $this->postJson("/projects/{$project->id}/tasks", ['title' => 'T', 'assignee_id' => $member->id])->assertCreated();

        $task = $this->makeTask($project, $manager);
        $this->patchJson("/tasks/{$task->id}", ['assignee_id' => $outsider->id])->assertUnprocessable();
    }

    public function test_non_member_gets_403_on_project_tasks_and_task_endpoints(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $task = $this->makeTask($project, $manager);
        $outsider = $this->makeUser('manager');

        $this->actingAs($outsider)->getJson("/projects/{$project->id}/tasks")->assertForbidden();
        $this->postJson("/projects/{$project->id}/tasks", ['title' => 'X'])->assertForbidden();
        $this->getJson("/tasks/{$task->id}")->assertForbidden();
        $this->patchJson("/tasks/{$task->id}", ['title' => 'X'])->assertForbidden();
        $this->deleteJson("/tasks/{$task->id}")->assertForbidden();
        $this->getJson("/tasks/{$task->id}/comments")->assertForbidden();
        $this->postJson("/tasks/{$task->id}/comments", ['body' => 'x'])->assertForbidden();
        $this->getJson("/tasks/{$task->id}/activities")->assertForbidden();
        $this->getJson("/projects/{$project->id}/activities")->assertForbidden();

        $this->actingAs($this->makeUser('admin'))->getJson("/tasks/{$task->id}")->assertOk();
    }

    public function test_staff_can_update_but_not_delete_task_manager_can(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager);

        $this->actingAs($staff)->patchJson("/tasks/{$task->id}", ['title' => 'Ubah'])->assertOk();
        $this->deleteJson("/tasks/{$task->id}")->assertForbidden();

        $this->actingAs($manager)->deleteJson("/tasks/{$task->id}")->assertNoContent();
        $this->assertDatabaseMissing('tasks', ['id' => $task->id]);

        // Jejak penghapusan tetap ada, task_id dikosongkan (R14).
        $log = Activity::where('action', 'task.deleted')->firstOrFail();
        $this->assertNull($log->task_id);
        $this->assertSame($project->id, $log->project_id);
    }

    public function test_each_change_writes_exactly_one_activity_row(): void
    {
        $manager = $this->makeUser('manager');
        $member = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');
        $task = $this->makeTask($project, $manager);
        $high = Priority::where('name', 'high')->value('id');
        $this->actingAs($manager);

        $this->patchJson("/tasks/{$task->id}", ['status' => 'in_progress'])->assertOk();
        $this->patchJson("/tasks/{$task->id}", ['priority_id' => $high])->assertOk();
        $this->patchJson("/tasks/{$task->id}", ['assignee_id' => $member->id])->assertOk();
        $this->patchJson("/tasks/{$task->id}", ['title' => 'Judul baru'])->assertOk();
        $this->patchJson("/tasks/{$task->id}", ['title' => 'Judul baru'])->assertOk(); // tidak berubah, tidak dicatat

        foreach (['task.status_changed', 'task.priority_changed', 'task.assigned', 'task.updated'] as $action) {
            $this->assertSame(1, Activity::where('action', $action)->count(), $action);
        }
        $this->assertStringContainsString('todo ke in_progress', Activity::where('action', 'task.status_changed')->value('description'));
    }

    public function test_task_list_filter_sort_search_and_pagination(): void
    {
        $manager = $this->makeUser('manager');
        $member = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $member, 'staff');
        $low = Priority::where('name', 'low')->value('id');
        $med = Priority::where('name', 'medium')->value('id');
        $high = Priority::where('name', 'high')->value('id');

        $this->makeTask($project, $manager, ['title' => 'Alpha', 'priority_id' => $med, 'due_date' => '2026-03-01']);
        $this->makeTask($project, $manager, ['title' => 'Beta', 'priority_id' => $high, 'status' => 'done', 'due_date' => '2026-01-01']);
        $this->makeTask($project, $manager, ['title' => '100% jadi', 'priority_id' => $low, 'assignee_id' => $member->id]);
        $this->makeTask($project, $manager, ['title' => '100x jadi', 'priority_id' => $low]);
        $other = $this->makeProject($manager);
        $this->makeTask($other, $manager, ['title' => 'Alpha lain project']);

        $titles = fn ($r) => collect($r->json('data'))->pluck('title')->all();
        $url = "/projects/{$project->id}/tasks";
        $this->actingAs($manager);

        $this->assertSame(['Beta', 'Alpha'], array_slice($titles($this->getJson("$url?sort=priority&order=desc")), 0, 2));
        $this->assertSame('Beta', $titles($this->getJson("$url?sort=priority&order=desc"))[0]);
        $this->assertContains($titles($this->getJson("$url?sort=priority&order=asc"))[0], ['100% jadi', '100x jadi']);
        $this->assertSame(['Beta'], $titles($this->getJson("$url?status=done")));
        $this->assertSame(['100% jadi'], $titles($this->getJson("$url?assignee_id={$member->id}")));
        $this->assertEqualsCanonicalizing(['100% jadi', '100x jadi'], $titles($this->getJson("$url?priority_id=$low")));
        $this->assertSame(['Alpha'], $titles($this->getJson("$url?q=ALPH")));
        $this->assertSame(['100% jadi'], $titles($this->getJson($url.'?q='.urlencode('100%')))); // % di-escape
        $this->assertSame(['Beta', 'Alpha'], array_slice($titles($this->getJson("$url?sort=due_date&order=asc")), 0, 2));
        $this->getJson("$url?sort=drop_table")->assertUnprocessable();
        $this->getJson($url)->assertJsonPath('meta.per_page', 25);
    }

    public function test_comments_oldest_first_and_log_activity(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager);

        $this->actingAs($staff)->postJson("/tasks/{$task->id}/comments", ['body' => 'pertama'])->assertCreated()->assertJsonPath('data.author.id', $staff->id);
        $this->actingAs($manager)->postJson("/tasks/{$task->id}/comments", ['body' => 'kedua'])->assertCreated();
        $this->postJson("/tasks/{$task->id}/comments", ['body' => ''])->assertUnprocessable();

        $this->getJson("/tasks/{$task->id}/comments")->assertOk()
            ->assertJsonPath('data.0.body', 'pertama')->assertJsonPath('data.1.body', 'kedua');
        $this->assertSame(2, Activity::where('action', 'comment.created')->count());

        $this->patchJson('/comments/1', ['body' => 'x'])->assertNotFound(); // tak ada endpoint ubah/hapus
    }

    public function test_activity_feeds_newest_first_project_includes_tasks_and_is_read_only(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $this->actingAs($manager);
        $t1 = $this->postJson("/projects/{$project->id}/tasks", ['title' => 'A'])->json('data.id');
        $t2 = $this->postJson("/projects/{$project->id}/tasks", ['title' => 'B'])->json('data.id');
        $this->postJson("/tasks/{$t1}/comments", ['body' => 'hai']);

        $project_feed = $this->getJson("/projects/{$project->id}/activities")->assertOk();
        $this->assertSame('comment.created', $project_feed->json('data.0.action'));
        $this->assertCount(3, $project_feed->json('data'));
        $this->assertSame('task.created', $project_feed->json('data.1.action'));
        $this->assertSame($t2, $project_feed->json('data.1.task_id'));

        $this->getJson("/tasks/{$t1}/activities")->assertOk()->assertJsonCount(2, 'data');
        $this->getJson("/tasks/{$t2}/activities")->assertOk()->assertJsonCount(1, 'data');

        $this->postJson("/projects/{$project->id}/activities", [])->assertStatus(405);
        $this->deleteJson("/projects/{$project->id}/activities")->assertStatus(405);
        $this->patchJson("/tasks/{$t1}/activities", [])->assertStatus(405);
    }
}
