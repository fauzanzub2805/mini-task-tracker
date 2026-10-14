@extends('layouts.guest')

@section('title', 'Masuk')

@php
    // Data awal untuk React — dirender sekali sebagai JSON, tanpa UI di Blade.
    // user: null untuk tamu; saat sesi aktif berisi identitas dari sesi Laravel.
    $loginOptions = [
        'csrfToken' => csrf_token(),
        'oldEmail' => old('email', ''),
        'user' => $currentUser,
    ];
@endphp

@section('app')
    <div id="login-app" class="min-h-full" data-login-app='@json($loginOptions)'></div>
@endsection
