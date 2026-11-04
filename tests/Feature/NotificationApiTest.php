<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\ProjectMember;
use Carbon\Carbon;

class NotificationApiTest extends ApiTestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function alert(int $userId, string $title = 'Test'): AppNotification
    {
        return AppNotification::create(['user_id' => $userId, 'type' => 'test', 'title' => $title, 'body' => 'Body', 'url' => '/dashboard']);
    }

    public function test_auth_recipient_isolation_pagination_and_snapshot_safe_read_all(): void
    {
        $this->getJson('/notifications')->assertUnauthorized();
        $this->postJson('/notifications/read-all', ['through_id' => 0])->assertUnauthorized();
        $user = $this->makeUser();
        $other = $this->makeUser();
        $foreign = $this->alert($other->id, 'Private');
        foreach (range(1, 23) as $index) {
            $this->alert($user->id, "Alert {$index}");
        }
        $response = $this->actingAs($user)->getJson('/notifications')->assertOk()->assertJsonCount(20, 'data')
            ->assertJsonPath('unread_count', 23)->assertJsonMissing(['title' => 'Private']);
        $this->getJson('/notifications?before_id='.$response->json('next_before_id'))->assertJsonCount(3, 'data');
        $this->postJson("/notifications/{$foreign->id}/read")->assertNotFound();
        $first = $response->json('data.0.id');
        $this->postJson("/notifications/{$first}/read")->assertNoContent();
        $this->postJson("/notifications/{$first}/read")->assertNoContent();
        $this->getJson('/notifications')->assertJsonPath('unread_count', 22);
        $new = $this->alert($user->id);
        $this->postJson('/notifications/read-all', ['through_id' => $response->json('through_id')])->assertNoContent();
        $this->getJson('/notifications')->assertJsonPath('unread_count', 1);
        $this->assertNull($new->fresh()->read_at);
        $this->assertNull($foreign->fresh()->read_at);
        $this->postJson('/notifications/read-all', [])->assertUnprocessable();
    }

    public function test_new_message_creates_alert_and_reading_conversation_syncs_it(): void
    {
        $sender = $this->makeUser();
        $recipient = $this->makeUser();
        $message = $this->actingAs($sender)->postJson("/messaging/users/{$recipient->id}/messages", ['body' => 'Hello'])->assertCreated()->json('data.id');
        $this->getJson('/notifications')->assertJsonPath('unread_count', 0);
        $this->actingAs($recipient)->getJson('/notifications')->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.type', 'message.received')->assertJsonPath('data.0.url', '/profile/messages?user='.$sender->id);
        $this->postJson("/messaging/users/{$sender->id}/read", ['through_id' => $message])->assertOk();
        $this->getJson('/notifications')->assertJsonPath('unread_count', 0);
        $this->actingAs($sender)->deleteJson("/messaging/messages/{$message}")->assertNoContent();
        $this->assertDatabaseCount('app_notifications', 0);
    }

    public function test_project_membership_assignment_status_deadline_and_mentions_notify_recipients_not_actor(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser();
        $other = $this->makeUser();
        $project = $this->makeProject($manager);
        $this->actingAs($manager)->postJson("/projects/{$project->id}/members", ['user_id' => $staff->id, 'role' => 'staff'])->assertCreated();
        $this->assertDatabaseHas('app_notifications', ['user_id' => $staff->id, 'type' => 'project.member_added']);
        $taskId = $this->postJson("/projects/{$project->id}/tasks", ['title' => 'Assigned task', 'assignee_ids' => [$staff->id]])->assertCreated()->json('data.id');
        $this->assertDatabaseHas('app_notifications', ['user_id' => $staff->id, 'type' => 'task.assigned', 'task_id' => $taskId]);
        $this->patchJson("/tasks/{$taskId}", ['assignee_ids' => [$staff->id]])->assertOk();
        $this->assertSame(1, AppNotification::where('type', 'task.assigned')->count());
        $this->patchJson("/tasks/{$taskId}", ['status' => 'in_progress', 'due_date' => '2030-05-15'])->assertOk();
        $this->assertDatabaseHas('app_notifications', ['user_id' => $staff->id, 'type' => 'task.status_changed']);
        $this->assertDatabaseHas('app_notifications', ['user_id' => $staff->id, 'type' => 'task.deadline_changed']);
        $this->postJson("/tasks/{$taskId}/comments", ['body' => 'Please review', 'mention_ids' => [$staff->id]])->assertCreated();
        $this->assertDatabaseHas('app_notifications', ['user_id' => $staff->id, 'type' => 'comment.mentioned']);
        $this->assertSame(0, AppNotification::where('user_id', $manager->id)->count());
        $this->actingAs($other)->getJson('/notifications')->assertJsonPath('unread_count', 0);
        $this->actingAs($staff)->patchJson("/tasks/{$taskId}", ['status' => 'done'])->assertOk();
        $this->assertDatabaseHas('app_notifications', ['user_id' => $manager->id, 'type' => 'task.status_changed']);
        ProjectMember::where('project_id', $project->id)->where('user_id', $staff->id)->delete();
        $this->actingAs($staff)->getJson('/notifications')->assertJsonCount(0, 'data')->assertJsonPath('unread_count', 0);
    }

    public function test_deadlines_use_current_wib_date_deduplicate_and_roll_over_at_midnight(): void
    {
        config(['notifications.timezone' => 'Asia/Jakarta']);
        Carbon::setTestNow(Carbon::parse('2030-05-14 16:59:00', 'UTC')); // May 14, 23:59 WIB
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser();
        $project = $this->makeProject($manager);
        $this->join($project, $staff, 'staff');
        $task = $this->makeTask($project, $manager, ['due_date' => '2030-05-15']);
        $task->syncAssignees([$staff->id]);
        $done = $this->makeTask($project, $manager, ['due_date' => '2030-05-14', 'status' => 'done']);
        $done->syncAssignees([$staff->id]);
        $this->actingAs($staff)->getJson('/notifications')->assertJsonPath('today', '2030-05-14')->assertJsonCount(0, 'data');
        Carbon::setTestNow(Carbon::parse('2030-05-14 17:00:00', 'UTC'));
        $response = $this->getJson('/notifications')->assertJsonPath('today', '2030-05-15')
            ->assertJsonPath('timezone', 'Asia/Jakarta')->assertJsonPath('data.0.type', 'task.due_today');
        $this->getJson('/notifications')->assertJsonCount(1, 'data');
        $this->postJson('/notifications/'.$response->json('data.0.id').'/read')->assertNoContent();
        $this->getJson('/notifications')->assertJsonPath('unread_count', 0);
        Carbon::setTestNow(Carbon::parse('2030-05-15 17:00:00', 'UTC'));
        $this->getJson('/notifications')->assertJsonCount(1, 'data')->assertJsonPath('data.0.type', 'task.overdue');
        $this->getJson('/notifications')->assertJsonCount(1, 'data');
        $task->update(['status' => 'done']);
        $this->getJson('/notifications')->assertJsonCount(0, 'data');
        $task->update(['status' => 'todo', 'due_date' => '2030-05-20']);
        $this->getJson('/notifications')->assertJsonCount(0, 'data');
        $task->update(['due_date' => '2030-05-16']);
        $this->getJson('/notifications')->assertJsonCount(1, 'data');
        $task->syncAssignees([]);
        $this->getJson('/notifications')->assertJsonCount(0, 'data');
    }

    public function test_non_members_do_not_receive_deadlines_even_with_legacy_assignments(): void
    {
        $manager = $this->makeUser('manager');
        $outsider = $this->makeUser();
        $task = $this->makeTask($this->makeProject($manager), $manager, [
            'due_date' => now(config('notifications.timezone'))->toDateString(), 'assignee_id' => $outsider->id,
        ]);
        $this->actingAs($outsider)->getJson('/notifications')->assertJsonCount(0, 'data');
        $this->join($task->project, $outsider, 'staff');
        $this->getJson('/notifications')->assertJsonPath('data.0.type', 'task.due_today');
        ProjectMember::where('user_id', $outsider->id)->delete();
        $this->getJson('/notifications')->assertJsonCount(0, 'data');
    }
}
