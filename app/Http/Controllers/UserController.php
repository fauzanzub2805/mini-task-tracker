<?php

namespace App\Http\Controllers;

use App\Http\Resources\UserResource;
use App\Models\User;

class UserController extends Controller
{
    /** Daftar anggota tim untuk memilih calon anggota project. Perlu login. */
    public function index()
    {
        return UserResource::collection(User::with('roles')->orderBy('name')->orderBy('id')->paginate(25));
    }
}
