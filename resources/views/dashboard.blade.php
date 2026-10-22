<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    @php
        $page = match (true) {
            request()->routeIs('profile.messages') => 'messages',
            request()->routeIs('profile') => 'profile',
            default => 'dashboard',
        };
        $isAppPage = request()->routeIs('dashboard', 'profile', 'profile.messages');
        $account = $isAppPage ? request()->user() : null;
        $dashboardOptions = [
            'page' => $page,
            'user' => $account ? [
                'id' => $account->id,
                'name' => $account->name,
                'roles' => $account->getRoleNames()->values()->all(),
            ] : null,
        ];
        $title = match ($page) {
            'messages' => 'Message',
            'profile' => 'Profile',
            default => 'Dashboard Preview',
        };
    @endphp
    <title>{{ $title }} · Rekayasa Task Tracker</title>
    @fonts
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/dashboard.jsx'])
</head>
<body class="font-sans antialiased">
    <div id="dashboard-app" data-dashboard='@json($dashboardOptions)'></div>
    <noscript>Aktifkan JavaScript untuk melihat halaman ini.</noscript>
</body>
</html>
