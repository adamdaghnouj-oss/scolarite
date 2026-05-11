<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SecurityRoutesTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_management_routes_require_authentication(): void
    {
        $this->getJson('/api/students')->assertUnauthorized();
        $this->getJson('/api/accounts/students')->assertUnauthorized();
        $this->getJson('/api/profiles/pending')->assertUnauthorized();
    }

    public function test_user_management_routes_require_admin_role(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'student']));

        $this->getJson('/api/students')->assertForbidden();
        $this->getJson('/api/accounts/students')->assertForbidden();
        $this->getJson('/api/profiles/pending')->assertForbidden();
    }

    public function test_public_registration_rejects_privileged_roles(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Privileged User',
            'email' => 'privileged@example.com',
            'password' => 'StrongPass123!',
            'password_confirmation' => 'StrongPass123!',
            'role' => 'administrateur',
        ])->assertUnprocessable();
    }
}
