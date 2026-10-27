<?php

namespace Tests\Feature;

class DashboardLiveDataApiTest extends ApiTestCase
{
    public function test_dashboard_sources_are_scoped_to_membership_for_manager_and_staff(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser();
        $other = $this->makeUser('manager');
        $visible = $this->makeProject($manager);
        $hidden = $this->makeProject($other);
        $this->join($visible, $staff, 'staff');
        $task = $this->makeTask($visible, $manager);
        $secret = $this->makeTask($hidden, $other);

        foreach ([$manager, $staff] as $user) {
            $this->actingAs($user);
            $this->getJson('/projects')->assertOk()->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.id', $visible->id);
            $this->getJson("/projects/{$visible->id}/tasks")->assertOk()
                ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $task->id)
                ->assertJsonMissing(['id' => $secret->id]);
            $this->getJson("/projects/{$visible->id}/members")->assertOk();
            $this->getJson("/projects/{$hidden->id}/tasks")->assertForbidden();
            $this->getJson("/projects/{$hidden->id}/members")->assertForbidden();
        }

        $this->actingAs($this->makeUser('admin'));
        $this->getJson('/projects')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson("/projects/{$hidden->id}/tasks")->assertOk()->assertJsonPath('data.0.id', $secret->id);
        $this->getJson("/projects/{$hidden->id}/members")->assertOk();
    }

    public function test_dashboard_sources_require_authentication(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        foreach (['/projects', "/projects/{$project->id}/tasks", "/projects/{$project->id}/members"] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
    }

    public function test_task_source_preserves_statuses_across_pagination(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $statuses = ['todo', 'in_progress', 'finish_dev', 'testing', 'done'];
        foreach ($statuses as $status) {
            for ($i = 0; $i < 6; $i++) {
                $this->makeTask($project, $manager, ['status' => $status]);
            }
        }
        $this->actingAs($manager);
        $first = $this->getJson("/projects/{$project->id}/tasks")->assertOk()->assertJsonCount(25, 'data');
        $this->assertNotNull($first->json('links.next'));
        $second = $this->getJson($first->json('links.next'))->assertOk()->assertJsonCount(5, 'data');
        $this->assertNull($second->json('links.next'));
        $rows = collect(array_merge($first->json('data'), $second->json('data')));
        $this->assertCount(30, $rows->unique('id'));
        foreach ($statuses as $status) {
            $this->assertSame(6, $rows->where('status', $status)->count());
        }
    }
}
