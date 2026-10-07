<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class AuthController extends Controller
{
    /** Registrasi satu-satunya jalur pembuat akun (TSD 4.9). */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = DB::transaction(function () use ($request) {
            // Kunci baris agar dua penukaran bersamaan atas token yang sama tidak lolos.
            $invitation = Invitation::where('token', $request->token)->lockForUpdate()->first();

            if (! $invitation || ! $invitation->isUsable()) {
                throw ValidationException::withMessages([
                    'token' => 'Token undangan tidak valid, sudah terpakai, dicabut, atau kedaluwarsa.',
                ]);
            }

            if (User::where('email', $invitation->email)->exists()) {
                throw ValidationException::withMessages(['token' => 'Email undangan sudah terdaftar.']);
            }

            // Email dan peran diambil dari undangan, bukan dari form.
            $user = User::create([
                'name' => $request->name,
                'email' => $invitation->email,
                'password_hash' => $request->password,
            ]);
            $user->assignRole(Role::findById($invitation->role_id, 'web'));

            $invitation->update([
                'status' => Invitation::STATUS_ACCEPTED,
                'accepted_at' => now(),
            ]);

            return $user;
        });

        Auth::login($user);
        $request->session()->regenerate();

        return (new UserResource($user->load('roles')))->response()->setStatusCode(201);
    }

    public function login(LoginRequest $request): UserResource
    {
        if (! Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages(['email' => trans('auth.failed')]);
        }

        $request->session()->regenerate();

        return new UserResource($request->user()->load('roles'));
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logout berhasil.']);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('roles'));
    }
}
