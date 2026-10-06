<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Comment;
use App\Models\Invitation;
use App\Models\Priority;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use LogicException;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ModelRelationsTest extends TestCase
{
    use RefreshDatabase;

    private function makeAdmin(): User
    {
        $role = Role::create(['name' => 'admin', 'guard_name' => 'web']);

        // Baris bootstrap: invited_by_id NULL.
        $invitation = Invitation::create([
            'email' => ' Admin@Example.COM ',
            'token' => str_repeat('a', 64),
            'invited_by_id' => null,
            'role_id' => $role->id,
            'status' => Invitation::STATUS_ACCEPTED,
            'expires_at' => now()->addDay(),
            'accepted_at' => now(),
        ]);

        $user = User::create([
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'password_hash' => 'rahasia123',
        ]);
        $user->assignRole($role);

        return $user;
    }

    /** @return array{0: User, 1: Project, 2: Task} */
    private function makeProjectWithTask(): array
    {
        $user = $this->makeAdmin();
        $manager = Role::create(['name' => 'manager', 'guard_name' => 'web']);
        $medium = Priority::create(['name' => 'medium', 'level' => 2]);

        $project = Project::create(['name' => 'Proyek A', 'created_by_id' => $user->id]);
        ProjectMember::create(['project_id' => $project->id, 'user_id' => $user->id, 'role_id' => $manager->id]);

        $task = Task::create([
            'project_id' => $project->id,
            'title' => 'Tugas 1',
            'status' => Task::STATUS_TODO,
            'priority_id' => $medium->id,
            'created_by_id' => $user->id,
        ]);

        return [$user, $project, $task];
    }

    public function test_invitation_email_is_stored_lowercase_and_trimmed(): void
    {
        $this->makeAdmin();

        $this->assertSame('admin@example.com', Invitation::first()->email);
    }

    public function test_password_is_stored_hashed_in_password_hash_column(): void
    {
        $user = $this->makeAdmin();

        $this->assertNotSame('rahasia123', $user->password_hash);
        $this->assertTrue(Hash::check('rahasia123', $user->password_hash));
        $this->assertSame($user->password_hash, $user->getAuthPassword());
        $this->assertSame('password_hash', $user->getAuthPasswordName());
        $this->assertArrayNotHasKey('password', $user->getAttributes());
        $this->assertArrayNotHasKey('password_hash', $user->toArray());
    }

    public function test_login_works_with_password_hash_column(): void
    {
        $this->makeAdmin();

        $this->assertTrue(Auth::attempt(['email' => 'admin@example.com', 'password' => 'rahasia123']));
        Auth::logout();
        $this->assertFalse(Auth::attempt(['email' => 'admin@example.com', 'password' => 'salah']));
    }

    public function test_global_role_is_stored_via_spatie_not_on_users_table(): void
    {
        $user = $this->makeAdmin();

        $this->assertTrue($user->hasRole('admin'));
        $this->assertSame('admin', $user->invitation->role->name);
    }

    public function test_relations_between_project_task_comment_and_activity(): void
    {
        [$user, $project, $task] = $this->makeProjectWithTask();

        Comment::create(['task_id' => $task->id, 'author_id' => $user->id, 'body' => 'Halo']);
        Activity::create([
            'project_id' => $project->id,
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'task.created',
            'description' => 'Tugas 1 dibuat',
        ]);

        $this->assertSame('medium', $task->priority->name);
        $this->assertCount(1, $project->tasks);
        $this->assertCount(1, $task->comments);
        $this->assertCount(1, $project->activities);
        $this->assertSame($user->id, $project->creator->id);
        $this->assertEquals(Role::findByName('manager', 'web')->id, $user->projects->first()->pivot->role_id);
        $this->assertNotNull(ProjectMember::first()->joined_at);
    }

    public function test_priority_id_has_no_default_in_database(): void
    {
        [$user, $project] = $this->makeProjectWithTask();

        $this->expectException(QueryException::class);

        Task::create(['project_id' => $project->id, 'title' => 'Tanpa prioritas', 'created_by_id' => $user->id]);
    }

    public function test_activity_is_append_only_through_model(): void
    {
        [$user, $project] = $this->makeProjectWithTask();
        $activity = Activity::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'action' => 'project.created',
        ]);

        try {
            $activity->update(['description' => 'diubah']);
            $this->fail('update seharusnya ditolak');
        } catch (LogicException) {
            $this->assertTrue(true);
        }

        $this->expectException(LogicException::class);
        $activity->delete();
    }

    public function test_deleting_a_task_cascades_comments_and_nulls_activity_task_id(): void
    {
        [$user, $project, $task] = $this->makeProjectWithTask();
        Comment::create(['task_id' => $task->id, 'author_id' => $user->id, 'body' => 'Halo']);
        $activity = Activity::create([
            'project_id' => $project->id,
            'task_id' => $task->id,
            'user_id' => $user->id,
            'action' => 'task.created',
        ]);

        $task->delete();

        $this->assertSame(0, Comment::count());
        $this->assertNull($activity->fresh()->task_id);
    }

    public function test_project_with_tasks_cannot_be_deleted(): void
    {
        [, $project] = $this->makeProjectWithTask();

        $this->expectException(QueryException::class);

        $project->delete();
    }
}
