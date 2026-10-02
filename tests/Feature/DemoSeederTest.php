<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Comment;
use App\Models\Invitation;
use App\Models\Priority;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoDataSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_reference_data_matches_erd(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(3, Role::count());
        $this->assertSame(14, Permission::count());
        $this->assertEqualsCanonicalizing(['admin', 'manager', 'staff'], Role::pluck('name')->all());

        $this->assertSame(14, Role::findByName('admin', 'web')->permissions()->count());
        $this->assertSame(11, Role::findByName('manager', 'web')->permissions()->count());
        $this->assertSame(6, Role::findByName('staff', 'web')->permissions()->count());
        $this->assertFalse(Role::findByName('staff', 'web')->hasPermissionTo('task.delete'));

        $this->assertSame(
            ['low' => 1, 'medium' => 2, 'high' => 3],
            Priority::orderBy('level')->pluck('level', 'name')->all()
        );

        // model_has_permissions tidak dipakai di MVP: semua izin lewat role.
        $this->assertSame(0, DB::table('model_has_permissions')->count());
    }

    public function test_demo_data_has_one_user_per_role_and_can_log_in(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(6, User::count());
        $this->assertSame(1, User::role('admin')->count());
        $this->assertSame(2, User::role('manager')->count());
        $this->assertSame(3, User::role('staff')->count());

        $admin = User::where('email', 'admin@example.com')->firstOrFail();
        $this->assertTrue($admin->hasRole('admin'));
        $this->assertTrue(Hash::check(DemoDataSeeder::PASSWORD, $admin->password_hash));
        $this->assertNotSame(DemoDataSeeder::PASSWORD, $admin->password_hash);
    }

    public function test_invitations_follow_erd_rules(): void
    {
        $this->seed(DatabaseSeeder::class);

        // Hanya baris bootstrap (admin) yang invited_by_id-nya NULL.
        $this->assertSame(1, Invitation::whereNull('invited_by_id')->count());
        $this->assertSame(
            'admin@example.com',
            Invitation::whereNull('invited_by_id')->firstOrFail()->email
        );

        // Tiap user punya undangan sendiri (invitation_id unik), peran undangan = peran global.
        foreach (User::with('invitation.role')->get() as $user) {
            $this->assertSame($user->email, $user->invitation->email);
            $this->assertTrue($user->hasRole($user->invitation->role->name));
        }

        $this->assertSame(9, Invitation::count());
        $this->assertSame(6, Invitation::where('status', 'accepted')->count());
        $this->assertSame(1, Invitation::where('status', 'revoked')->count());
        $this->assertSame(2, Invitation::where('status', 'pending')->count());
        $this->assertSame(1, Invitation::where('status', 'pending')->where('expires_at', '<', now())->count());

        Invitation::all()->each(fn (Invitation $i) => $this->assertSame(64, strlen($i->token)));
    }

    public function test_projects_tasks_comments_and_activities_are_consistent(): void
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(2, Project::count());
        $this->assertSame(8, Task::count());
        $this->assertSame(6, Comment::count());

        foreach (Project::with('tasks', 'members')->get() as $project) {
            $this->assertSame(4, $project->tasks->count());

            // Pembuat project adalah anggota dengan peran project manager.
            $creatorMembership = $project->members->firstWhere('user_id', $project->created_by_id);
            $this->assertNotNull($creatorMembership);
            $this->assertSame(Role::findByName('manager', 'web')->id, $creatorMembership->role_id);

            // Assignee wajib anggota project.
            $memberIds = $project->members->pluck('user_id');
            foreach ($project->tasks->whereNotNull('assignee_id') as $task) {
                $this->assertTrue($memberIds->contains($task->assignee_id));
            }
        }

        // Peran per-project boleh berbeda dari peran global: Budi manager global, staff di project 2.
        $budi = User::where('email', 'budi.manager@example.com')->firstOrFail();
        $this->assertTrue($budi->hasRole('manager'));
        $staffRoleId = Role::findByName('staff', 'web')->id;
        $this->assertTrue($budi->projects->contains(fn ($p) => $p->pivot->role_id === $staffRoleId));

        // Variasi data: ketiga status dan ketiga prioritas terwakili.
        $this->assertEqualsCanonicalizing(['todo', 'in_progress', 'done'], Task::distinct()->pluck('status')->all());
        $this->assertSame(3, Task::distinct('priority_id')->count('priority_id'));

        // Activities hanya memakai 11 nilai action dari ERD.
        $this->assertGreaterThan(0, Activity::count());
        $this->assertSame(
            [],
            array_values(array_diff(Activity::distinct()->pluck('action')->all(), DemoDataSeeder::ACTIONS))
        );
    }

    public function test_seeding_twice_does_not_duplicate_data(): void
    {
        $this->seed(DatabaseSeeder::class);

        $counts = fn () => [
            'roles' => Role::count(),
            'permissions' => Permission::count(),
            'priorities' => Priority::count(),
            'invitations' => Invitation::count(),
            'users' => User::count(),
            'projects' => Project::count(),
            'members' => DB::table('project_members')->count(),
            'tasks' => Task::count(),
            'comments' => Comment::count(),
            'activities' => Activity::count(),
            'model_has_roles' => DB::table('model_has_roles')->count(),
        ];

        $before = $counts();
        $this->seed(DatabaseSeeder::class);

        $this->assertSame($before, $counts());
    }

    public function test_demo_data_is_skipped_in_production(): void
    {
        $this->app['env'] = 'production';

        // db:seed menolak jalan di production tanpa --force (minta konfirmasi interaktif).
        $this->artisan('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true])
            ->assertSuccessful();

        // Data referensi tetap ada, data demo tidak.
        $this->assertSame(3, Role::count());
        $this->assertSame(14, Permission::count());
        $this->assertSame(3, Priority::count());
        $this->assertSame(0, User::count());
        $this->assertSame(0, Project::count());
        $this->assertSame(0, Invitation::count());
    }
}
