<?php

namespace Tests\Feature;

class DashboardMonitoringApiTest extends ApiTestCase
{
    public function test_summary_and_rows_come_from_the_same_membership_scoped_snapshot(): void
    {
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser();
        $other = $this->makeUser('manager');
        $visible = $this->makeProject($manager);
        $hidden = $this->makeProject($other);
        $this->join($visible, $staff, 'staff');

        $statuses = ['todo', 'todo', 'in_progress', 'finish_dev', 'testing', 'done'];
        foreach ($statuses as $status) {
            $this->makeTask($visible, $manager, ['status' => $status]);
        }
        $assigned = $this->makeTask($visible, $manager, ['title' => 'Punya staff']);
        $assigned->syncAssignees([$staff->id]);
        $secret = $this->makeTask($hidden, $other, ['status' => 'done']);

        foreach ([$manager, $staff] as $user) {
            $response = $this->actingAs($user)->getJson('/dashboard/monitoring')->assertOk()
                ->assertJsonPath('total', 7)
                ->assertJsonPath('summary', ['todo' => 3, 'in_progress' => 1, 'finish_dev' => 1, 'testing' => 1, 'done' => 1])
                ->assertJsonMissing(['id' => $secret->id, 'project_id' => $hidden->id]);

            $rows = collect($response->json('data'));
            $this->assertCount(7, $rows);
            // Angka ringkasan selalu sama dengan isi daftar.
            foreach ($response->json('summary') as $status => $count) {
                $this->assertSame($count, $rows->where('status', $status)->count());
            }

            $row = $rows->firstWhere('id', $assigned->id);
            $this->assertSame(['id' => $visible->id, 'name' => $visible->name], $row['project']);
            $this->assertSame([['id' => $staff->id, 'name' => $staff->name]], $row['assignees']);
            $this->assertSame([['id' => $manager->id, 'name' => $manager->name]], $row['managers']);
        }

        // Admin melihat seluruh project.
        $this->actingAs($this->makeUser('admin'))->getJson('/dashboard/monitoring')->assertOk()
            ->assertJsonPath('total', 8)
            ->assertJsonPath('summary.done', 2);
    }

    public function test_user_without_projects_gets_zero_summary_and_no_rows(): void
    {
        $this->actingAs($this->makeUser())->getJson('/dashboard/monitoring')->assertOk()
            ->assertExactJson([
                'summary' => ['todo' => 0, 'in_progress' => 0, 'finish_dev' => 0, 'testing' => 0, 'done' => 0],
                'total' => 0,
                'data' => [],
            ]);
    }

    public function test_monitoring_requires_authentication(): void
    {
        $this->getJson('/dashboard/monitoring')->assertUnauthorized();
    }

    public function test_etag_returns_304_until_the_data_changes(): void
    {
        $manager = $this->makeUser('manager');
        $project = $this->makeProject($manager);
        $task = $this->makeTask($project, $manager);
        $this->actingAs($manager);

        $first = $this->getJson('/dashboard/monitoring')->assertOk()->assertJsonPath('summary.todo', 1);
        $etag = $first->headers->get('ETag');
        $this->assertNotEmpty($etag);

        $unchanged = $this->getJson('/dashboard/monitoring', ['If-None-Match' => $etag])->assertStatus(304);
        $this->assertSame('', $unchanged->getContent());

        $this->patchJson("/tasks/{$task->id}", ['status' => 'in_progress'])->assertOk();

        $changed = $this->getJson('/dashboard/monitoring', ['If-None-Match' => $etag])->assertOk()
            ->assertJsonPath('summary.todo', 0)
            ->assertJsonPath('summary.in_progress', 1)
            ->assertJsonPath('data.0.status', 'in_progress');
        $this->assertNotSame($etag, $changed->headers->get('ETag'));
    }
}
