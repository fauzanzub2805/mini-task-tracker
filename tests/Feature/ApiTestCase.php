<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\PrioritySeeder;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([RolesAndPermissionsSeeder::class, PrioritySeeder::class]);
    }

    protected function makeUser(string $globalRole = 'staff'): User
    {
        $user = User::factory()->create();
        $user->assignRole($globalRole);

        return $user;
    }

    protected function makeProject(User $creator, string $creatorRole = 'manager'): Project
    {
        $project = Project::create(['name' => 'Proyek', 'created_by_id' => $creator->id]);
        $this->join($project, $creator, $creatorRole);

        return $project;
    }

    protected function join(Project $project, User $user, string $role): void
    {
        ProjectMember::create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role_id' => Role::findByName($role, 'web')->id,
        ]);
    }

    protected function makeTask(Project $project, User $creator, array $attrs = []): Task
    {
        return Task::create($attrs + [
            'project_id' => $project->id,
            'title' => 'Task',
            'priority_id' => \App\Models\Priority::where('name', 'medium')->value('id'),
            'created_by_id' => $creator->id,
        ]);
    }
}
