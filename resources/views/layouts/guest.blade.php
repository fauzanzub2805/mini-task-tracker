<!DOCTYPE html>
<html lang="id" class="h-full">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <meta name="robots" content="noindex">

        <title>@yield('title', 'Masuk') · {{ config('app.name', 'Mini Task Tracker') }}</title>

        @fonts
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    </head>
    <body class="h-full bg-slate-50 font-sans text-slate-900 antialiased">
        {{-- Host minimal: seluruh UI (panel brand, form, panel berhasil) dirender React. --}}
        @yield('app')
        <noscript>Aktifkan JavaScript untuk menggunakan halaman login.</noscript>
    </body>
</html>
