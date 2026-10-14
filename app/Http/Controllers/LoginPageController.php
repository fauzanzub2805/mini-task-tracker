<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * Halaman login (host minimal Blade + React). Proses autentikasi tetap
 * ditangani oleh endpoint JSON POST /auth/login (AuthController::login);
 * controller ini hanya menyiapkan data bootstrap lalu merender view.
 */
class LoginPageController extends Controller
{
    public function __invoke(Request $request): View
    {
        $user = $request->user();

        // Bila sesi masih aktif (mis. halaman di-reload setelah login),
        // React langsung menampilkan panel "Login berhasil" alih-alih form.
        $currentUser = $user ? [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $user->getRoleNames()->values()->all(),
        ] : null;

        return view('auth.login', ['currentUser' => $currentUser]);
    }
}
