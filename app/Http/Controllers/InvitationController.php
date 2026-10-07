<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreInvitationRequest;
use App\Http\Resources\InvitationResource;
use App\Models\Invitation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class InvitationController extends Controller
{
    /** Masa berlaku token undangan (menit). */
    public const TTL_MINUTES = 10;

    public function index(Request $request)
    {
        Gate::authorize('invitation.view');

        $request->validate(['status' => ['nullable', 'in:pending,accepted,revoked']]);

        $invitations = Invitation::query()
            ->with('role')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate(25);

        return InvitationResource::collection($invitations);
    }

    public function store(StoreInvitationRequest $request): JsonResponse
    {
        Gate::authorize('invitation.create');

        // invitations.email UNIQUE: satu baris per alamat, undangan ulang menyegarkan baris yang sama.
        $invitation = Invitation::firstOrNew(['email' => $request->email]);

        if ($invitation->exists && $invitation->status === Invitation::STATUS_ACCEPTED) {
            throw ValidationException::withMessages(['email' => 'Undangan untuk email ini sudah diterima.']);
        }

        $invitation->fill([
            'token' => bin2hex(random_bytes(32)), // 64 karakter hex dari CSPRNG
            'invited_by_id' => $request->user()->id,
            'role_id' => $request->role_id,
            'status' => Invitation::STATUS_PENDING,
            'expires_at' => now()->addMinutes(self::TTL_MINUTES),
            'accepted_at' => null,
        ])->save();

        $link = url('/register?token='.$invitation->token);
        Mail::raw(
            "Anda diundang ke Mini Task Tracker.\n\nDaftar melalui tautan berikut (berlaku ".self::TTL_MINUTES." menit):\n{$link}\n",
            fn ($message) => $message->to($invitation->email)->subject('Undangan Mini Task Tracker'),
        );

        return (new InvitationResource($invitation->load('role')))->response()->setStatusCode(201);
    }

    /** Publik: memvalidasi token sebelum form registrasi ditampilkan. */
    public function show(string $token): JsonResponse
    {
        $invitation = Invitation::with('role')->where('token', $token)->first();

        abort_if(! $invitation, 404, 'Undangan tidak ditemukan.');

        if (! $invitation->isUsable()) {
            return response()->json(['message' => 'Undangan sudah terpakai, dicabut, atau kedaluwarsa.'], 422);
        }

        return response()->json(['data' => [
            'email' => $invitation->email,
            'role' => $invitation->role->name,
            'expires_at' => $invitation->expires_at,
        ]]);
    }

    /** Hanya undangan pending yang bisa dicabut. */
    public function destroy(Invitation $invitation): InvitationResource
    {
        Gate::authorize('invitation.revoke');

        if ($invitation->status !== Invitation::STATUS_PENDING) {
            throw ValidationException::withMessages(['invitation' => 'Hanya undangan berstatus pending yang bisa dicabut.']);
        }

        $invitation->update(['status' => Invitation::STATUS_REVOKED]);

        return new InvitationResource($invitation->load('role'));
    }
}
