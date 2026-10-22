<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Halaman dashboard mengarah ke login; endpoint API tetap JSON 401.
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('dashboard', 'profile', 'profile/messages') ? route('login') : null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Endpoint API tetap JSON; halaman frontend boleh mengembalikan HTML.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => ! $request->is('/', 'login', 'dashboard', 'dashboard/preview', 'profile', 'profile/messages') || $request->expectsJson(),
        );
    })->create();
