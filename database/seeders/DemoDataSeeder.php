<?php

namespace Database\Seeders;

use App\Models\Activity;
use App\Models\Comment;
use App\Models\Invitation;
use App\Models\Priority;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;
use Spatie\Permission\Models\Role;

/**
 * Data contoh untuk development / demo (mis. dilihat lewat DBeaver).
 * Dilewati otomatis di production. Idempotent: dijalankan ulang tidak menggandakan data.
 *
 * Semua akun demo memakai password: "password".
 */
class DemoDataSeeder extends Seeder
{
    public const PASSWORD = 'password';

    /** 11 nilai activities.action yang diizinkan ERD (divalidasi di aplikasi, bukan CHECK di DB). */
    public const ACTIONS = [
        'project.created', 'project.updated', 'project.member_added', 'project.member_removed',
        'task.created', 'task.updated', 'task.status_changed', 'task.priority_changed',
        'task.assigned', 'task.deleted', 'comment.created',
    ];

    /** @var array<string, int> nama role => id */
    private array $roleIds = [];

    /** @var array<string, int> nama priority => id */
    private array $priorityIds = [];

    public function run(): void
    {
        if (app()->isProduction()) {
            $this->command?->warn('DemoDataSeeder dilewati: environment production.');

            return;
        }

        $this->roleIds = Role::where('guard_name', RolesAndPermissionsSeeder::GUARD)
            ->whereIn('name', ['admin', 'manager', 'staff'])
            ->pluck('id', 'name')
            ->all();
        $this->priorityIds = Priority::pluck('id', 'name')->all();

        if (count($this->roleIds) !== 3 || count($this->priorityIds) !== 3) {
            throw new RuntimeException(
                'Role/priority belum ada. Jalankan RolesAndPermissionsSeeder dan PrioritySeeder dulu.'
            );
        }

        DB::transaction(function () {
            $users = $this->seedUsersAndInvitations();
            $this->seedProjects($users);
        });

        $this->command?->info('Data demo siap. Login mana saja dengan password "'.self::PASSWORD.'".');
    }

    /**
     * Admin = baris bootstrap (invited_by_id NULL). Manager diundang admin,
     * staff diundang manager. Ditambah undangan pending, kedaluwarsa, dan dicabut.
     *
     * @return array<string, User>
     */
    private function seedUsersAndInvitations(): array
    {
        $admin = $this->makeUser('Admin Sistem', 'admin@example.com', 'admin', null);
        $budi = $this->makeUser('Budi Santoso', 'budi.manager@example.com', 'manager', $admin);
        $citra = $this->makeUser('Citra Lestari', 'citra.manager@example.com', 'manager', $admin);
        $dewi = $this->makeUser('Dewi Anggraini', 'dewi.staff@example.com', 'staff', $budi);
        $eka = $this->makeUser('Eka Prasetyo', 'eka.staff@example.com', 'staff', $budi);
        $fajar = $this->makeUser('Fajar Nugroho', 'fajar.staff@example.com', 'staff', $citra);

        // Undangan yang belum menjadi akun: pending, kedaluwarsa (dihitung dari expires_at), dicabut.
        $this->makeInvitation('gilang.staff@example.com', 'staff', $budi, Invitation::STATUS_PENDING, now()->addDays(7));
        $this->makeInvitation('hana.staff@example.com', 'staff', $budi, Invitation::STATUS_PENDING, now()->subDays(3));
        $this->makeInvitation('indra.staff@example.com', 'staff', $admin, Invitation::STATUS_REVOKED, now()->addDays(5));

        return compact('admin', 'budi', 'citra', 'dewi', 'eka', 'fajar');
    }

    private function makeInvitation(string $email, string $roleName, ?User $inviter, string $status, Carbon $expiresAt): Invitation
    {
        return Invitation::firstOrCreate(
            ['email' => $email],
            [
                // 64 karakter acak (hex). Belum final: format penyimpanan token ditentukan di fase auth.
                'token' => hash('sha256', Str::random(64)),
                'invited_by_id' => $inviter?->id,
                'role_id' => $this->roleIds[$roleName],
                'status' => $status,
                'expires_at' => $expiresAt,
                'accepted_at' => $status === Invitation::STATUS_ACCEPTED ? now() : null,
            ]
        );
    }

    private function makeUser(string $name, string $email, string $roleName, ?User $inviter): User
    {
        // Gerbang ERD: tidak ada akun tanpa undangan (undangan dicocokkan lewat email).
        $this->makeInvitation(
            $email,
            $roleName,
            $inviter,
            Invitation::STATUS_ACCEPTED,
            now()->addDays(7),
        );

        $user = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password_hash' => self::PASSWORD, // di-hash otomatis oleh cast 'hashed'
            ]
        );

        // Peran global disimpan di model_has_roles (bukan kolom di users).
        if (! $user->hasRole($roleName)) {
            $user->assignRole($roleName);
        }

        return $user;
    }

    /**
     * @param  array<string, User>  $u
     */
    private function seedProjects(array $u): void
    {
        $definitions = [
            [
                'name' => 'Website Redesign Perusahaan',
                'description' => 'Perombakan situs perusahaan: wireframe, desain responsif, dan migrasi konten blog.',
                'creator' => 'budi',
                'age_days' => 14,
                // Pembuat otomatis jadi anggota dengan peran project "manager".
                'members' => [['dewi', 'staff'], ['eka', 'staff']],
                'tasks' => [
                    [
                        'title' => 'Susun wireframe halaman beranda',
                        'description' => 'Wireframe low-fidelity untuk desktop dan mobile.',
                        'status' => Task::STATUS_DONE, 'priority' => 'high', 'assignee' => 'dewi', 'due' => -5,
                        'comments' => [
                            ['eka', 'Wireframe sudah saya review, siap lanjut ke tahap desain.'],
                            ['budi', 'Terima kasih, ditandai selesai.'],
                        ],
                    ],
                    [
                        'title' => 'Implementasi desain responsif',
                        'description' => 'Terapkan layout responsif untuk breakpoint mobile, tablet, dan desktop.',
                        'status' => Task::STATUS_IN_PROGRESS, 'priority' => 'high', 'assignee' => 'eka', 'due' => 7,
                        'bumped_from' => 'medium',
                        'comments' => [
                            ['eka', 'Layout mobile sudah jadi, tablet masih dikerjakan.'],
                        ],
                    ],
                    [
                        'title' => 'Migrasi konten blog lama',
                        'description' => 'Pindahkan artikel dari situs lama beserta gambar dan tautannya.',
                        'status' => Task::STATUS_TODO, 'priority' => 'medium', 'assignee' => 'dewi', 'due' => 14,
                        'comments' => [],
                    ],
                    [
                        'title' => 'Audit aksesibilitas',
                        'description' => 'Periksa kontras warna, label form, dan navigasi keyboard.',
                        'status' => Task::STATUS_TODO, 'priority' => 'low', 'assignee' => null, 'due' => null,
                        'comments' => [],
                    ],
                ],
            ],
            [
                'name' => 'Aplikasi Mobile MVP',
                'description' => 'Versi pertama aplikasi mobile: autentikasi, daftar tugas, dan notifikasi.',
                'creator' => 'citra',
                'age_days' => 10,
                // Budi manager secara global, tetapi di project ini hanya "staff":
                // contoh peran per-project yang boleh berbeda dari peran global.
                'members' => [['fajar', 'staff'], ['dewi', 'staff'], ['budi', 'staff']],
                'tasks' => [
                    [
                        'title' => 'Rancang skema autentikasi mobile',
                        'description' => 'Alur login berbasis undangan dan penyimpanan sesi di perangkat.',
                        'status' => Task::STATUS_DONE, 'priority' => 'high', 'assignee' => 'fajar', 'due' => -3,
                        'comments' => [
                            ['citra', 'Skema disetujui, lanjutkan implementasi.'],
                        ],
                    ],
                    [
                        'title' => 'Bangun layar daftar tugas',
                        'description' => 'Daftar task dengan filter status dan urutan berdasarkan prioritas.',
                        'status' => Task::STATUS_IN_PROGRESS, 'priority' => 'medium', 'assignee' => 'fajar', 'due' => 10,
                        'comments' => [
                            ['fajar', 'Filter status sudah berfungsi, urutan prioritas menyusul.'],
                            ['citra', 'Oke, tolong utamakan urutan prioritas dulu.'],
                        ],
                    ],
                    [
                        'title' => 'Integrasi notifikasi push',
                        'description' => 'Kirim notifikasi saat task ditugaskan atau berubah status.',
                        'status' => Task::STATUS_TODO, 'priority' => 'low', 'assignee' => 'dewi', 'due' => 21,
                        'comments' => [],
                    ],
                    [
                        'title' => 'Uji coba beta internal',
                        'description' => 'Bagikan build beta ke tim internal dan kumpulkan masukan.',
                        'status' => Task::STATUS_TODO, 'priority' => 'high', 'assignee' => 'budi', 'due' => 30,
                        'comments' => [],
                    ],
                ],
            ],
        ];

        foreach ($definitions as $def) {
            // Idempotent: project yang sudah ada dilewati beserta seluruh isinya.
            if (Project::where('name', $def['name'])->exists()) {
                continue;
            }

            $this->seedProject($def, $u);
        }
    }

    /**
     * @param  array<string, mixed>  $def
     * @param  array<string, User>  $u
     */
    private function seedProject(array $def, array $u): void
    {
        $creator = $u[$def['creator']];
        $start = now()->subDays($def['age_days']);

        $project = new Project;
        $project->forceFill([
            'name' => $def['name'],
            'description' => $def['description'],
            'created_by_id' => $creator->id,
            'created_at' => $start,
            'updated_at' => $start,
        ])->save();

        $this->log($project, null, $creator, 'project.created', "{$creator->name} membuat project \"{$project->name}\".", $start);

        // Anggota: pembuat (manager) + anggota lain dengan peran per-project.
        $memberIds = [$creator->id];
        $this->addMember($project, $creator, 'manager', $start);

        foreach ($def['members'] as $i => [$key, $projectRole]) {
            $member = $u[$key];
            $at = $start->copy()->addMinutes(5 * ($i + 1));
            $this->addMember($project, $member, $projectRole, $at);
            $memberIds[] = $member->id;
            $this->log($project, null, $creator, 'project.member_added', "{$creator->name} menambahkan {$member->name} sebagai {$projectRole}.", $at);
        }

        foreach ($def['tasks'] as $i => $t) {
            $assignee = $t['assignee'] !== null ? $u[$t['assignee']] : null;

            // Aturan ERD: assignee wajib anggota project terkait.
            if ($assignee !== null && ! in_array($assignee->id, $memberIds, true)) {
                throw new InvalidArgumentException("Assignee {$assignee->name} bukan anggota project \"{$project->name}\".");
            }

            $createdAt = $start->copy()->addDays($i + 1);

            $task = new Task;
            $task->forceFill([
                'project_id' => $project->id,
                'title' => $t['title'],
                'description' => $t['description'],
                'status' => Task::STATUS_TODO,
                'priority_id' => $this->priorityIds[$t['bumped_from'] ?? $t['priority']],
                'due_date' => $t['due'] !== null ? now()->addDays($t['due'])->toDateString() : null,
                'assignee_id' => $assignee?->id,
                'created_by_id' => $creator->id,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ])->save();

            $this->log($project, $task, $creator, 'task.created', "{$creator->name} membuat task \"{$task->title}\".", $createdAt);

            if ($assignee !== null) {
                $this->log($project, $task, $creator, 'task.assigned', "{$creator->name} menugaskan \"{$task->title}\" kepada {$assignee->name}.", $createdAt->copy()->addHour());
            }

            if (isset($t['bumped_from'])) {
                $at = $createdAt->copy()->addHours(2);
                $task->forceFill(['priority_id' => $this->priorityIds[$t['priority']], 'updated_at' => $at])->save();
                $this->log($project, $task, $creator, 'task.priority_changed', "{$creator->name} mengubah prioritas \"{$task->title}\" dari {$t['bumped_from']} ke {$t['priority']}.", $at);
            }

            if ($t['status'] !== Task::STATUS_TODO) {
                $at = $createdAt->copy()->addDay();
                $actor = $assignee ?? $creator;
                $task->forceFill(['status' => $t['status'], 'updated_at' => $at])->save();
                $this->log($project, $task, $actor, 'task.status_changed', "{$actor->name} mengubah status \"{$task->title}\" dari todo ke {$t['status']}.", $at);
            }

            foreach ($t['comments'] as $j => [$authorKey, $body]) {
                $author = $u[$authorKey];
                $at = $createdAt->copy()->addDay()->addHours($j + 1);

                $comment = new Comment;
                $comment->forceFill([
                    'task_id' => $task->id,
                    'author_id' => $author->id,
                    'body' => $body,
                    'created_at' => $at,
                    'updated_at' => $at,
                ])->save();

                $this->log($project, $task, $author, 'comment.created', "{$author->name} berkomentar pada \"{$task->title}\".", $at);
            }
        }
    }

    private function addMember(Project $project, User $user, string $roleName, Carbon $joinedAt): void
    {
        (new ProjectMember)->forceFill([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role_id' => $this->roleIds[$roleName],
            'joined_at' => $joinedAt,
        ])->save();
    }

    /** Activities hanya-tambah, dan hanya boleh memakai 11 nilai action dari ERD. */
    private function log(Project $project, ?Task $task, User $actor, string $action, string $description, Carbon $at): void
    {
        if (! in_array($action, self::ACTIONS, true)) {
            throw new InvalidArgumentException("Action \"{$action}\" tidak ada di ERD.");
        }

        (new Activity)->forceFill([
            'project_id' => $project->id,
            'task_id' => $task?->id,
            'user_id' => $actor->id,
            'action' => $action,
            'description' => $description,
            'created_at' => $at,
        ])->save();
    }
}
