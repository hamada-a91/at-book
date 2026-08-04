<?php

namespace Tests\Feature;

use App\Jobs\ProcessBelegOcrJob;
use App\Models\Beleg;
use App\Services\Ocr\DocumentExtractor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\Support\TenantTestDataFactory;
use Tests\TestCase;

class BelegOcrTest extends TestCase
{
    use RefreshDatabase;

    public function test_ocr_upload_creates_pending_draft_and_dispatches_job(): void
    {
        Queue::fake();
        Storage::fake('public');
        $data = TenantTestDataFactory::create('ocr-upload');
        $token = auth('api')->login($data->user);

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->post('/api/belege/ocr-upload', [
                'file' => UploadedFile::fake()->image('rechnung.jpg')->size(512),
            ]);

        $response->assertAccepted()
            ->assertJsonPath('ocr_status', 'pending')
            ->assertJsonPath('ocr_provider', 'tesseract');

        $beleg = Beleg::withoutGlobalScopes()->findOrFail($response->json('id'));
        $this->assertSame($data->tenant->id, $beleg->tenant_id);
        $this->assertSame('draft', $beleg->status);
        $this->assertSame('pending', $beleg->ocr_status);
        Storage::disk('public')->assertExists($beleg->file_path);

        Queue::assertPushed(ProcessBelegOcrJob::class);
    }

    public function test_ocr_upload_rejects_invalid_file_type(): void
    {
        Queue::fake();
        $data = TenantTestDataFactory::create('ocr-invalid');
        $token = auth('api')->login($data->user);

        $this->withHeaders([
            'Authorization' => "Bearer {$token}",
            'Accept' => 'application/json',
        ])->post('/api/belege/ocr-upload', [
            'file' => UploadedFile::fake()->create('rechnung.txt', 10, 'text/plain'),
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['file']);

        Queue::assertNothingPushed();
    }

    public function test_job_sets_tenant_context_and_marks_done(): void
    {
        $data = TenantTestDataFactory::create('ocr-job');
        $beleg = $this->makeOcrBeleg($data->tenant->id);

        app()->forgetInstance('currentTenant');
        app()->instance(DocumentExtractor::class, new class implements DocumentExtractor
        {
            public ?int $tenantId = null;

            public function extract(Beleg $beleg): array
            {
                $this->tenantId = tenant()?->id;

                return [
                    'provider' => 'tesseract',
                    'source' => 'pdf-text-layer',
                    'raw_text' => 'Gesamtbetrag 119,00 EUR',
                    'fields' => [
                        'gross_amount' => ['value' => 11_900, 'confidence' => 0.9, 'source' => 'test'],
                    ],
                    'confidence' => 0.9,
                ];
            }
        });

        $extractor = app(DocumentExtractor::class);
        (new ProcessBelegOcrJob($beleg->id, $data->tenant->id))->handle($extractor);

        $beleg->refresh();
        $this->assertSame($data->tenant->id, $extractor->tenantId);
        $this->assertSame('done', $beleg->ocr_status);
        $this->assertSame('tesseract', $beleg->ocr_provider);
        $this->assertSame(11_900, $beleg->ocr_data['fields']['gross_amount']['value']);
        $this->assertDatabaseHas('audit_logs', [
            'tenant_id' => $data->tenant->id,
            'auditable_type' => Beleg::class,
            'auditable_id' => $beleg->id,
            'event' => 'beleg_ocr_extracted',
        ]);
    }

    public function test_job_marks_failed_but_keeps_beleg_usable(): void
    {
        $data = TenantTestDataFactory::create('ocr-failed');
        $beleg = $this->makeOcrBeleg($data->tenant->id);

        app()->instance(DocumentExtractor::class, new class implements DocumentExtractor
        {
            public function extract(Beleg $beleg): array
            {
                throw new RuntimeException('tesseract fehlt');
            }
        });

        (new ProcessBelegOcrJob($beleg->id, $data->tenant->id))->handle(app(DocumentExtractor::class));

        $beleg->refresh();
        $this->assertSame('failed', $beleg->ocr_status);
        $this->assertSame('draft', $beleg->status);
        $this->assertSame('tesseract fehlt', $beleg->ocr_data['error']);
    }

    private function makeOcrBeleg(int $tenantId): Beleg
    {
        return Beleg::create([
            'tenant_id' => $tenantId,
            'document_number' => 'BLG-OCR-'.uniqid(),
            'document_type' => 'eingang',
            'title' => 'OCR-Testbeleg',
            'document_date' => '2026-07-15',
            'amount' => 0,
            'tax_amount' => 0,
            'status' => 'draft',
            'ocr_status' => 'pending',
            'ocr_provider' => 'tesseract',
        ]);
    }
}
