<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\DirectMessageController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\LoginPageController;
use App\Http\Controllers\PriorityController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectMemberController;
use App\Http\Controllers\TaskAttachmentController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// Halaman frontend (host Blade minimal + React + Tailwind)
Route::redirect('/', '/login');
Route::get('/login', LoginPageController::class)->name('login');

// Preview UI saja: tidak memuat data pengguna/project nyata atau endpoint AI.
Route::view('/dashboard/preview', 'dashboard')->name('dashboard.preview');

// Publik
Route::get('/invitations/{token}', [InvitationController::class, 'show']);
Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

// Perlu login (guard web, session cookie)
Route::middleware('auth')->group(function () {
    Route::view('/dashboard', 'dashboard')->name('dashboard');
    Route::view('/profile', 'dashboard')->name('profile');
    Route::view('/profile/messages', 'dashboard')->name('profile.messages');
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    Route::get('/invitations', [InvitationController::class, 'index']);
    Route::post('/invitations', [InvitationController::class, 'store']);
    Route::delete('/invitations/{invitation}', [InvitationController::class, 'destroy']);

    Route::get('/users', [UserController::class, 'index']);
    Route::get('/priorities', [PriorityController::class, 'index']);

    Route::get('/projects', [ProjectController::class, 'index']);
    Route::post('/projects', [ProjectController::class, 'store']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);
    Route::patch('/projects/{project}', [ProjectController::class, 'update']);
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

    Route::get('/projects/{project}/members', [ProjectMemberController::class, 'index']);
    Route::post('/projects/{project}/members', [ProjectMemberController::class, 'store']);
    Route::patch('/projects/{project}/members/{userId}', [ProjectMemberController::class, 'update'])->whereNumber('userId');
    Route::delete('/projects/{project}/members/{userId}', [ProjectMemberController::class, 'destroy'])->whereNumber('userId');

    Route::get('/projects/{project}/tasks', [TaskController::class, 'index']);
    Route::post('/projects/{project}/tasks', [TaskController::class, 'store']);
    Route::get('/projects/{project}/tasks/{task}', [TaskController::class, 'page'])->name('tasks.page');
    Route::get('/tasks/{task}', [TaskController::class, 'show']);
    Route::patch('/tasks/{task}', [TaskController::class, 'update']);
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy']);

    // Lampiran privat: unggah, unduh, dan hapus.
    Route::post('/tasks/{task}/attachments', [TaskAttachmentController::class, 'store'])->name('tasks.attachments.store');
    Route::get('/tasks/{task}/attachments/{attachment}', [TaskAttachmentController::class, 'download'])->name('tasks.attachments.download');
    Route::delete('/tasks/{task}/attachments/{attachment}', [TaskAttachmentController::class, 'destroy'])->name('tasks.attachments.destroy');

    Route::get('/tasks/{task}/comments', [CommentController::class, 'index']);
    Route::post('/tasks/{task}/comments', [CommentController::class, 'store']);

    Route::get('/projects/{project}/activities', [ActivityController::class, 'project']);
    Route::get('/tasks/{task}/activities', [ActivityController::class, 'task']);

    // Pesan langsung untuk halaman Profile > Message.
    Route::prefix('messaging')->name('messaging.')->group(function () {
        Route::get('/users', [DirectMessageController::class, 'users'])->name('users.index');
        Route::get('/conversations', [DirectMessageController::class, 'conversations'])->name('conversations.index');
        Route::get('/users/{user}/messages', [DirectMessageController::class, 'messages'])->whereNumber('user')->name('users.messages.index');
        Route::post('/users/{user}/messages', [DirectMessageController::class, 'store'])->whereNumber('user')->name('users.messages.store');
        Route::post('/users/{user}/read', [DirectMessageController::class, 'read'])->whereNumber('user')->name('users.read');
        Route::delete('/messages/{message}', [DirectMessageController::class, 'destroy'])->whereNumber('message')->name('messages.destroy');
        Route::get('/messages/{message}/attachment', [DirectMessageController::class, 'attachment'])->whereNumber('message')->name('messages.attachment');
    });
});
