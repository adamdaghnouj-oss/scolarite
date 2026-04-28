<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Ensure the authenticated user has one of the allowed roles.
     *
     * Usage: ->middleware('role:administrateur,directeur_etudes')
     */
    public function handle(Request $request, Closure $next, ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $role = $user->role;
        if (!$role || (count($roles) > 0 && !in_array($role, $roles, true))) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $next($request);
    }
}

