<?php

namespace Tests\Feature;

use App\Mail\SupportMail;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SupportMailTest extends TestCase
{
    use RefreshDatabase;

    protected function tokenFor(User $user): string
    {
        return auth('api')->login($user);
    }

    public function test_guest_cannot_send_support_email(): void
    {
        $response = $this->postJson('/api/support/send', [
            'subject' => 'Hilfe benötigt',
            'message' => 'Das ist eine Testnachricht.',
        ]);

        $response->assertStatus(401);
    }

    public function test_user_validation_errors_for_support_email(): void
    {
        $tenant = Tenant::create(['name' => 'Demo Tenant', 'slug' => 'demo-tenant']);
        $user = User::factory()->create(['tenant_id' => $tenant->id]);
        $token = $this->tokenFor($user);

        // Subject missing
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/support/send', [
                'message' => 'Das ist eine Testnachricht.',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['subject']);

        // Message too short
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/support/send', [
                'subject' => 'Hilfe benötigt',
                'message' => 'Kurz',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['message']);
    }

    public function test_user_can_send_support_email_successfully(): void
    {
        Mail::fake();

        $tenant = Tenant::create(['name' => 'Test Tenant Inc.', 'slug' => 'test-tenant']);
        $user = User::factory()->create([
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'tenant_id' => $tenant->id,
        ]);
        $token = $this->tokenFor($user);

        $adminEmail = config('atbook.admin_email', 'admin@at-book.local');

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/support/send', [
                'subject' => 'Fehler im Journal',
                'message' => 'Ich kann meine Buchungen im Journal nicht richtig exportieren.',
            ]);

        $response->assertStatus(200);
        $response->assertJson([
            'success' => true,
            'message' => 'Support-E-Mail wurde erfolgreich gesendet.',
        ]);

        Mail::assertSent(SupportMail::class, function ($mail) use ($user, $tenant, $adminEmail) {
            return $mail->hasTo($adminEmail) &&
                $mail->userName === $user->name &&
                $mail->userEmail === $user->email &&
                $mail->tenantName === $tenant->name &&
                $mail->tenantSlug === $tenant->slug &&
                $mail->supportSubject === 'Fehler im Journal' &&
                $mail->supportMessage === 'Ich kann meine Buchungen im Journal nicht richtig exportieren.';
        });
    }
}
