<?php

namespace App\Http\Controllers;

use App\Http\Resources\PriorityResource;
use App\Models\Priority;

class PriorityController extends Controller
{
    /** Terurut berdasarkan level, bukan id. */
    public function index()
    {
        return PriorityResource::collection(Priority::orderBy('level')->get());
    }
}
