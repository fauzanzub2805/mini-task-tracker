<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Dashboard Preview · Rekayasa Task Tracker</title>
    @fonts
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/dashboard.jsx'])
</head>
<body class="font-sans antialiased">
    @php
        $account = request()->routeIs('dashboard') ? request()->user() : null;
        $dashboardOptions = ['user' => $account ? [
            'name' => $account->name,
            'roles' => $account->getRoleNames()->values()->all(),
        ] : null];
    @endphp
    <div id="dashboard-app" data-dashboard='@json($dashboardOptions)'></div>
    <noscript>Aktifkan JavaScript untuk melihat dashboard.</noscript>
</body>
</html>
