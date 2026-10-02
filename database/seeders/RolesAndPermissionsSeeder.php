<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * Lapis 1 otorisasi: 3 role global x 14 permission (persis daftar di ERD Rev 4).
 * Idempotent: aman dijalankan berulang kali. Semua izin lewat role,
 * tidak ada givePermissionTo() langsung ke user (model_has_permissions tidak dipakai).
 */
class RolesAndPermissionsSeeder extends Seeder
{
    public const GUARD = 'web';

    /** 14 nama permission persis seperti di ERD. */
    public const PERMISSIONS = [
        'project.view',
        'project.create',
        'project.update',
        'project.delete',
        'project.member.manage',
        'task.view',
        'task.create',
        'task.update',
        'task.delete',
        'comment.create',
        'activity.view',
        'invitation.view',
        'invitation.create',
        'invitation.revoke',
    ];

    /**
     * ASUMSI (ERD hanya menyebut daftar role & permission, bukan pemetaannya).
     * Ubah di sini bila mentor menginginkan pemetaan lain.
     */
    public const ROLE_PERMISSIONS = [
        // admin: semua 14 permission.
        'admin' => self::PERMISSIONS,
        // manager: semua urusan project/task/komentar/aktivitas, tanpa undangan.
        'manager' => [
            'project.view', 'project.create', 'project.update', 'project.delete', 'project.member.manage',
            'task.view', 'task.create', 'task.update', 'task.delete',
            'comment.create', 'activity.view',
        ],
        // staff: melihat project, mengelola task (kecuali hapus), berkomentar.
        'staff' => [
            'project.view',
            'task.view', 'task.create', 'task.update',
            'comment.create', 'activity.view',
        ],
    ];

    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        foreach (self::PERMISSIONS as $name) {
            Permission::findOrCreate($name, self::GUARD);
        }

        foreach (self::ROLE_PERMISSIONS as $roleName => $permissions) {
            Role::findOrCreate($roleName, self::GUARD)->syncPermissions($permissions);
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
