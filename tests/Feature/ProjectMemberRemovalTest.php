<?php

namespace Tests\Feature;

use Spatie\Permission\Models\Role;

class ProjectMemberRemovalTest extends ApiTestCase
{
    public function test_removal_requires_project_permission_and_only_removes_membership(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser();
        $globalManager = $this->makeUser('manager');
        $outsider = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $other = $this->makeProject($outsider);
        $this->join($project, $staff, 'staff');
        $this->join($project, $globalManager, 'staff');
        $this->join($other, $staff, 'staff');
        $url = "/projects/{$project->id}/members/{$staff->id}";
        $this->deleteJson($url)->assertUnauthorized();
        foreach ([$staff, $globalManager, $outsider] as $user) {
            $this->actingAs($user)->deleteJson($url)->assertForbidden();
        }
        $this->actingAs($manager)->deleteJson("/projects/{$project->id}/members/{$outsider->id}")->assertNotFound();
        $this->deleteJson($url)->assertNoContent();
        $this->assertDatabaseMissing('project_members', ['project_id' => $project->id, 'user_id' => $staff->id]);
        $this->assertDatabaseHas('users', ['id' => $staff->id]);
        $this->assertDatabaseHas('project_members', ['project_id' => $other->id, 'user_id' => $staff->id]);
        $this->assertDatabaseHas('activities', ['project_id' => $project->id, 'action' => 'project.member_removed']);
        $this->deleteJson($url)->assertNotFound();
        $this->actingAs($staff)->getJson("/projects/{$project->id}")->assertForbidden();
    }

    public function test_last_manager_cannot_be_removed_or_demoted_even_by_admin(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $url = "/projects/{$project->id}/members/{$manager->id}";
        $staffRole = Role::findByName('staff', 'web')->id;
        foreach ([$manager, $this->makeUser('admin')] as $actor) {
            $this->actingAs($actor)->deleteJson($url)->assertConflict();
            $this->patchJson($url, ['role_id' => $staffRole])->assertConflict();
        }
        $this->assertDatabaseHas('project_members', ['project_id' => $project->id, 'user_id' => $manager->id, 'role_id' => Role::findByName('manager', 'web')->id]);
        $this->assertDatabaseMissing('activities', ['project_id' => $project->id, 'action' => 'project.member_removed']);
    }

    public function test_manager_removal_and_self_removal_are_allowed_when_another_manager_remains(): void
    {
        $manager = $this->makeUser('manager');
        $second = $this->makeUser();
        $project = $this->makeProject($manager);
        $this->join($project, $second, 'manager');
        $this->actingAs($manager)->deleteJson("/projects/{$project->id}/members/{$manager->id}")->assertNoContent();
        $this->assertDatabaseHas('users', ['id' => $manager->id]);
        $this->actingAs($second)->deleteJson("/projects/{$project->id}/members/{$second->id}")->assertConflict();
        $this->actingAs($this->makeUser('admin'))->postJson("/projects/{$project->id}/members", [
            'user_id' => $manager->id, 'role_id' => Role::findByName('manager', 'web')->id,
        ])->assertCreated();
        $this->deleteJson("/projects/{$project->id}/members/{$second->id}")->assertNoContent();
    }
}
