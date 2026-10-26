<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * Halaman HTML dan API JSON berbagi URL yang sama. Blade hanya dilayani
     * bila klien secara eksplisit meminta text/html (navigasi browser);
     * selain itu (termasuk Accept wildcard dan tanpa header) respons tetap JSON.
     */
    protected function wantsHtml(Request $request): bool
    {
        return str_contains((string) $request->header('Accept'), 'text/html');
    }
}
