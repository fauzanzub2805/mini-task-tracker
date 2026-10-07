<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Project;
use Spatie\Permission\Models\Role;

class ProjectMemberApiTest extends ApiTestCase
{
    public function test_staff_cannot_create_project_but_manager_and_admin_can(): void
    {
        $this->actingAs($this->makeUser('staff'))->postJson('/projects', ['name' => 'X'])->assertForbidden();

        $manager = $this->makeUser('manager');
        $res = $this->actingAs($manager)->postJson('/projects', ['name' => 'Alpha'])->assertCreated();

        $project = Project::findOrFail($res->json('data.id'));
        $this->assertSame('manager', $manager->roleInProject($project)->name);
        $this->assertSame(1, Activity::where('project_id', $project->id)->where('action', 'project.created')->count());

        $this->actingAs($this->makeUser('admin'))->postJson('/projects', ['name' => 'Beta'])->assertCreated();
        $this->postJson('/projects', [])->assertUnprocessable();
    }

    public function test_project_list_and_detail_are_scoped_by_membership_admin_sees_all(): void
    {
        $m1 = $this->makeUser('manager');
        $m2 = $this->makeUser('manager');
        $p1 = $this->makeProject($m1);
        $p2 = $this->makeProject($m2);

        $this->actingAs($m1)->getJson('/projects')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $p1->id);
        $this->getJson("/projects/{$p2->id}")->assertForbidden();
        $this->getJson("/projects/{$p1->id}")->assertOk();

        $this->actingAs($this->makeUser('admin'))->getJson('/projects')->assertJsonCount(2, 'data');
        $this->getJson("/projects/{$p2->id}")->assertOk();
    }

    public function test_update_and_delete_project_rules(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $this->join($project, $staff, 'staff');

        $this->actingAs($staff)->patchJson("/projects/{$project->id}", ['name' => 'Z'])->assertForbidden();
        $this->deleteJson("/projects/{$project->id}")->assertForbidden();

        $this->actingAs($manager)->patchJson("/projects/{$project->id}", ['name' => 'Baru'])->assertOk()->assertJsonPath('data.name', 'Baru');
        $this->assertSame(1, Activity::where('action', 'project.updated')->count());

        $this->makeTask($project, $manager);
        $this->deleteJson("/projects/{$project->id}")->assertStatus(409);

        $empty = $this->makeProject($manager);
        $this->deleteJson("/projects/{$empty->id}")->assertNoContent();
        $this->assertDatabaseMissing('projects', ['id' => $empty->id]);
    }

    public function test_manage_members_lifecycle(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser('staff');
        $project = $this->makeProject($manager);
        $managerRole = Role::findByName('manager', 'web');
        $staffRole = Role::findByName('staff', 'web');

        $this->actingAs($manager)->postJson("/projects/{$project->id}/members", ['user_id' => $staff->id, 'role_id' => $staffRole->id])
            ->assertCreated()->assertJsonPath('data.role.name', 'staff');
        $this->postJson("/projects/{$project->id}/members", ['user_id' => $staff->id, 'role_id' => $staffRole->id])->assertUnprocessable();
        $this->postJson("/projects/{$project->id}/members", ['user_id' => 9999, 'role_id' => $staffRole->id])->assertUnprocessable();
        $this->postJson("/projects/{$project->id}/members", ['user_id' => $staff->id, 'role_id' => Role::findByName('admin', 'web')->id])->assertUnprocessable();
        $this->assertSame(1, Activity::where('action', 'project.member_added')->count());

        // Staff global ditunjuk manager di project ini: boleh mengelola anggota, tetap tak bisa membuat project.
        $this->patchJson("/projects/{$project->id}/members/{$staff->id}", ['role_id' => $managerRole->id])->assertOk();
        $this->actingAs($staff->fresh())->getJson("/projects/{$project->id}/members")->assertOk()->assertJsonCount(2, 'data');
        $this->postJson('/projects', ['name' => 'Nope'])->assertForbidden();
        $newbie = $this->makeUser('staff');
        $this->postJson("/projects/{$project->id}/members", ['user_id' => $newbie->id, 'role_id' => $staffRole->id])->assertCreated();

        $this->deleteJson("/projects/{$project->id}/members/{$newbie->id}")->assertNoContent();
        $this->assertSame(1, Activity::where('action', 'project.member_removed')->count());
        $this->actingAs($newbie)->getJson("/projects/{$project->id}")->assertForbidden();
    }

    public function test_non_member_and_staff_cannot_manage_members(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser('staff');
        $outsider = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $this->join($project, $staff, 'staff');
        $body = ['user_id' => $outsider->id, 'role_id' => Role::findByName('staff', 'web')->id];

        $this->actingAs($staff)->postJson("/projects/{$project->id}/members", $body)->assertForbidden();
        $this->actingAs($outsider)->postJson("/projects/{$project->id}/members", $body)->assertForbidden();
        $this->getJson("/projects/{$project->id}/members")->assertForbidden();
    }

    public function test_users_and_priorities_endpoints(): void
    {
        $user = $this->makeUser('staff');
        $this->actingAs($user)->getJson('/users')->assertOk()->assertJsonMissingPath('data.0.password_hash');
        $this->getJson('/priorities')->assertOk()->assertJsonPath('data.0.name', 'low')->assertJsonPath('data.2.name', 'high');
    }
}
