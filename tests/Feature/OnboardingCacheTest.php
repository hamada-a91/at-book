<?php

namespace Tests\Feature;

use App\Http\Middleware\OnboardingMiddleware;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

/**
 * SPEC-07 (7.3, behebt 08/Punkt 14): OnboardingMiddleware cacht den
 * Onboarding-Status pro Tenant (statt bei jedem Fach-Request ein
 * company_settings-SELECT auszuführen) und invalidiert diesen Cache aktiv
 * bei OnboardingController::complete() (zusätzlich abgesichert über einen
 * saved()-Hook auf App\Models\CompanySetting, siehe dort).
 */
class OnboardingCacheTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Akzeptanzkriterium: bei warmem Cache macht die Middleware KEINE
     * company_settings-Query mehr.
     */
    public function test_warm_cache_avoids_company_settings_query(): void
    {
        $data = TenantTestDataFactory::create('cachewarm');
        $token = auth('api')->login($data->user);

        // Erster Request: Cache-Miss, füllt den Cache.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/dashboard/summary')
            ->assertOk();

        DB::enableQueryLog();

        // Zweiter Request: sollte den Cache treffen.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/dashboard/summary')
            ->assertOk();

        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $companySettingsQueries = array_filter(
            $queries,
            fn (array $q) => str_contains($q['query'], 'company_settings')
        );

        $this->assertEmpty(
            $companySettingsQueries,
            'Bei warmem Onboarding-Cache darf keine company_settings-Query mehr ausgeführt werden: '
            .json_encode(array_values($companySettingsQueries))
        );
    }

    /**
     * Akzeptanzkriterium: nach onboarding/complete ist eine geschützte Route
     * SOFORT erreichbar (nicht erst nach Ablauf der 1h-Cache-TTL).
     */
    public function test_cache_is_invalidated_immediately_after_complete(): void
    {
        $data = TenantTestDataFactory::create('cacheinv');
        $token = auth('api')->login($data->user);

        // Onboarding künstlich zurücksetzen (alle Pflichtfelder für complete()
        // bleiben erfüllt, nur der Status selbst wird auf "nicht abgeschlossen"
        // gesetzt) - simuliert den Zustand direkt vor dem finalen Schritt.
        $data->companySetting->update(['onboarding_completed' => false]);

        // Request VOR complete(): warmt den Cache mit "nicht abgeschlossen" und
        // muss geblockt werden.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/dashboard/summary')
            ->assertStatus(403);

        // complete() abschließen.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/onboarding/complete')
            ->assertOk();

        // Direkt danach muss die geschützte Route erreichbar sein - OHNE auf
        // den Ablauf der Cache-TTL zu warten.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/dashboard/summary')
            ->assertOk();
    }

    /**
     * Ergänzender Unit-Test der Invalidierungslogik selbst: das
     * saved()-Hook auf CompanySetting muss den passenden Cache-Key
     * (OnboardingMiddleware::cacheKey()) unabhängig vom Aufrufer (Controller,
     * Command, ...) vergessen.
     */
    public function test_company_setting_saved_hook_forgets_cache_key(): void
    {
        $data = TenantTestDataFactory::create('cachehook');

        $key = OnboardingMiddleware::cacheKey($data->tenant->id);
        Cache::put($key, true, 3600);
        $this->assertTrue(Cache::has($key));

        $data->companySetting->update(['onboarding_completed' => false]);

        $this->assertFalse(Cache::has($key), 'CompanySetting::saved() muss den Onboarding-Cache-Key des eigenen Tenants forgetten.');
    }
}
