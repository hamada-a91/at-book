<?php

namespace Tests\Feature;

use App\Models\Beleg;
use App\Models\Invoice;
use App\Models\User;
use App\Modules\Accounting\Models\AuditLog;
use App\Modules\Accounting\Models\JournalEntry;
use App\Modules\Accounting\Services\InvoiceBookingService;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Models\Role;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * SPEC-06 (Audit-Log aktivieren) - Akzeptanzkriterien:
 * - Buchung anlegen -> created-Eintrag mit User/Tenant/new_values
 * - lock/reverse/Invoice-book -> je EIGENER Event-Eintrag (kein Duplikat
 *   über den generischen 'updated'-Observer, siehe AuditObserver)
 * - Audit-Einträge sind append-only (update/delete werfen)
 * - Draft-Änderung protokolliert Diff (old_values -> new_values)
 * - Endpoint: Filterung, Pagination, Rollenprüfung, Tenant-Isolation
 * - password erscheint nie in old/new_values
 */
class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(User $user): string
    {
        return auth('api')->login($user);
    }

    public function test_creating_a_booking_writes_a_created_entry_with_user_tenant_and_new_values(): void
    {
        $data = TenantTestDataFactory::create('auditcreate');

        $log = AuditLog::where('auditable_type', JournalEntry::class)
            ->where('auditable_id', $data->journalDraft->id)
            ->where('event', 'created')
            ->first();

        $this->assertNotNull($log, 'createBooking() muss über den AuditObserver einen created-Eintrag erzeugen.');
        $this->assertSame($data->tenant->id, $log->tenant_id);
        $this->assertSame($data->user->id, $log->user_id);
        $this->assertSame($data->journalDraft->public_id, $log->auditable_public_id);
        $this->assertSame('draft', $log->new_values['status'] ?? null);
        $this->assertSame([], $log->old_values, 'created-Events haben keine alten Werte.');
    }

    public function test_locking_a_booking_writes_exactly_one_locked_event_no_duplicate_updated(): void
    {
        $data = TenantTestDataFactory::create('auditlock');

        $lockedLog = AuditLog::where('auditable_type', JournalEntry::class)
            ->where('auditable_id', $data->journalPosted->id)
            ->where('event', 'locked')
            ->first();

        $this->assertNotNull($lockedLog, 'BookingService::lockBooking() muss einen expliziten locked-Eintrag schreiben.');
        $this->assertSame('draft', $lockedLog->old_values['status'] ?? null);
        $this->assertSame('posted', $lockedLog->new_values['status'] ?? null);
        $this->assertNotNull($lockedLog->new_values['journal_number'] ?? null, 'SPEC-05: journal_number muss im locked-Eintrag stehen.');

        // AuditObserver::isServiceManaged() muss den generischen 'updated'-Eintrag
        // für GENAU diesen Übergang unterdrücken (sonst zwei Einträge für eine
        // fachliche Aktion).
        $duplicateUpdated = AuditLog::where('auditable_type', JournalEntry::class)
            ->where('auditable_id', $data->journalPosted->id)
            ->where('event', 'updated')
            ->count();
        $this->assertSame(0, $duplicateUpdated, 'lockBooking() darf keinen zusätzlichen generischen updated-Eintrag erzeugen.');
    }

    public function test_reversing_a_booking_writes_reversed_on_original_and_created_on_reversal(): void
    {
        $data = TenantTestDataFactory::create('auditreverse');

        $reversedLog = AuditLog::where('auditable_type', JournalEntry::class)
            ->where('auditable_id', $data->journalCancelled->id)
            ->where('event', 'reversed')
            ->first();
        $this->assertNotNull($reversedLog, 'reverseBooking() muss am ORIGINAL einen expliziten reversed-Eintrag schreiben.');
        $this->assertSame('posted', $reversedLog->old_values['status'] ?? null);
        $this->assertSame('cancelled', $reversedLog->new_values['status'] ?? null);
        $this->assertSame($data->journalReversal->public_id, $reversedLog->new_values['reversal_journal_entry_public_id'] ?? null);

        $createdOnReversal = AuditLog::where('auditable_type', JournalEntry::class)
            ->where('auditable_id', $data->journalReversal->id)
            ->where('event', 'created')
            ->first();
        $this->assertNotNull($createdOnReversal, 'Die neu erzeugte Storno-Buchung bekommt automatisch einen created-Eintrag über den AuditObserver.');

        // Kein doppelter 'updated' auf dem Original für den Storno-Statusflip.
        $duplicateUpdated = AuditLog::where('auditable_type', JournalEntry::class)
            ->where('auditable_id', $data->journalCancelled->id)
            ->where('event', 'updated')
            ->count();
        $this->assertSame(0, $duplicateUpdated);
    }

    public function test_booking_an_invoice_writes_a_booked_event(): void
    {
        $data = TenantTestDataFactory::create('auditinvoicebook');

        app()->instance('currentTenant', $data->tenant);
        Auth::setUser($data->user);

        app(InvoiceBookingService::class)->bookInvoice($data->invoice);

        $log = AuditLog::where('auditable_type', Invoice::class)
            ->where('auditable_id', $data->invoice->id)
            ->where('event', 'booked')
            ->first();

        $this->assertNotNull($log, 'InvoiceBookingService::bookInvoice() muss einen expliziten booked-Eintrag schreiben.');
        $this->assertSame('draft', $log->old_values['status'] ?? null);
        $this->assertSame('booked', $log->new_values['status'] ?? null);

        $duplicateUpdated = AuditLog::where('auditable_type', Invoice::class)
            ->where('auditable_id', $data->invoice->id)
            ->where('event', 'updated')
            ->count();
        $this->assertSame(0, $duplicateUpdated, 'bookInvoice() darf keinen zusätzlichen generischen updated-Eintrag erzeugen.');
    }

    public function test_recording_a_payment_writes_a_payment_recorded_event(): void
    {
        $data = TenantTestDataFactory::create('auditpayment');

        app()->instance('currentTenant', $data->tenant);
        Auth::setUser($data->user);

        $service = app(InvoiceBookingService::class);
        $service->bookInvoice($data->invoice);
        $service->recordPayment($data->invoice->fresh(), $data->accountBank->id, now()->toDateString());

        $log = AuditLog::where('auditable_type', Invoice::class)
            ->where('auditable_id', $data->invoice->id)
            ->where('event', 'payment_recorded')
            ->first();

        $this->assertNotNull($log);
        $this->assertSame('booked', $log->old_values['status'] ?? null);
        $this->assertSame('paid', $log->new_values['status'] ?? null);
    }

    public function test_updating_a_draft_beleg_logs_old_and_new_values_diff(): void
    {
        $data = TenantTestDataFactory::create('auditdraftdiff');

        app()->instance('currentTenant', $data->tenant);
        Auth::setUser($data->user);

        $originalTitle = $data->beleg->title;
        $data->beleg->update(['title' => 'Geänderter Titel (Test)']);

        $log = AuditLog::where('auditable_type', Beleg::class)
            ->where('auditable_id', $data->beleg->id)
            ->where('event', 'updated')
            ->latest('id')
            ->first();

        $this->assertNotNull($log, 'Eine Draft-Änderung muss einen generischen updated-Eintrag erzeugen.');
        $this->assertSame($originalTitle, $log->old_values['title'] ?? null);
        $this->assertSame('Geänderter Titel (Test)', $log->new_values['title'] ?? null);
        $this->assertArrayNotHasKey('status', $log->new_values, 'Nur GEÄNDERTE Attribute dürfen im Diff stehen.');
    }

    public function test_audit_log_cannot_be_updated(): void
    {
        $data = TenantTestDataFactory::create('auditimmutableupdate');

        $log = AuditLog::where('tenant_id', $data->tenant->id)->firstOrFail();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessageMatches('/unveränderlich/i');

        $log->update(['event' => 'tampered']);
    }

    public function test_audit_log_cannot_be_deleted(): void
    {
        $data = TenantTestDataFactory::create('auditimmutabledelete');

        $log = AuditLog::where('tenant_id', $data->tenant->id)->firstOrFail();

        $this->expectException(DomainException::class);
        $this->expectExceptionMessageMatches('/unveränderlich/i');

        $log->delete();
    }

    public function test_password_never_appears_in_audit_values(): void
    {
        $data = TenantTestDataFactory::create('auditpwcheck');

        $log = AuditLog::where('auditable_type', User::class)
            ->where('auditable_id', $data->user->id)
            ->where('event', 'created')
            ->first();

        $this->assertNotNull($log, 'Der Owner-User selbst wird über TenantTestDataFactory angelegt und muss einen created-Eintrag haben.');
        $this->assertArrayNotHasKey('password', $log->new_values);
        $this->assertArrayNotHasKey('remember_token', $log->new_values);
    }

    // ---- Endpoint: GET /api/audit-logs ----

    public function test_endpoint_filters_by_auditable_type_and_event_and_paginates(): void
    {
        $data = TenantTestDataFactory::create('auditendpoint');

        $token = $this->tokenFor($data->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/audit-logs?auditable_type=journal_entry&event=created');

        $response->assertStatus(200);
        $response->assertJsonPath('per_page', 20);

        $entries = $response->json('data');
        $this->assertNotEmpty($entries);
        foreach ($entries as $entry) {
            $this->assertSame('created', $entry['event']);
            $this->assertSame(JournalEntry::class, $entry['auditable_type']);
        }
    }

    public function test_endpoint_rejects_raw_class_names_for_auditable_type(): void
    {
        $data = TenantTestDataFactory::create('auditrawclass');

        $token = $this->tokenFor($data->user);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/audit-logs?auditable_type='.urlencode(JournalEntry::class));

        // Nur die Kurzname-Whitelist wird akzeptiert - ein roher Klassenname ist ungültig.
        $response->assertStatus(422);
    }

    public function test_endpoint_returns_403_for_cachier(): void
    {
        $data = TenantTestDataFactory::create('auditcachier');

        $cachier = User::create([
            'name' => 'Kassierer',
            'email' => 'cachier@audit-log.test',
            'password' => bcrypt('password'),
            'tenant_id' => $data->tenant->id,
        ]);
        $cachier->assignRole(Role::firstOrCreate(['name' => 'cachier', 'guard_name' => 'api']));

        $token = $this->tokenFor($cachier);
        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/audit-logs');

        $response->assertStatus(403);
    }

    public function test_endpoint_is_tenant_isolated(): void
    {
        $dataA = TenantTestDataFactory::create('audittenanta');
        $dataB = TenantTestDataFactory::create('audittenantb');

        $tokenB = $this->tokenFor($dataB->user);
        $response = $this->withHeader('Authorization', "Bearer {$tokenB}")
            ->getJson('/api/audit-logs?auditable_type=journal_entry&event=created');

        $response->assertStatus(200);

        $entries = collect($response->json('data'));
        $this->assertNotEmpty($entries);

        // Jeder zurückgegebene Eintrag muss zu Tenant B gehören ...
        $tenantIds = $entries->pluck('tenant_id')->unique();
        $this->assertCount(1, $tenantIds);
        $this->assertSame($dataB->tenant->id, $tenantIds->first());

        // ... und Tenant A's JournalEntry darf nicht darunter auftauchen.
        $auditableIds = $entries->pluck('auditable_id');
        $this->assertNotContains($dataA->journalDraft->id, $auditableIds);
    }

    public function test_endpoint_filters_by_date_range(): void
    {
        $data = TenantTestDataFactory::create('auditdaterange');

        $token = $this->tokenFor($data->user);

        $futureResponse = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/audit-logs?from='.now()->addDay()->toDateString());
        $futureResponse->assertStatus(200);
        $this->assertEmpty($futureResponse->json('data'), 'Ein from-Datum in der Zukunft darf keine Einträge liefern.');

        $pastResponse = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/audit-logs?from='.now()->subDay()->toDateString().'&to='.now()->addDay()->toDateString());
        $pastResponse->assertStatus(200);
        $this->assertNotEmpty($pastResponse->json('data'));
    }
}
