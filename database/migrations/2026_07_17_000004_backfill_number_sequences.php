<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * SPEC-05 (Teil A) Datenmigration: befüllt number_sequences.last_number aus den
 * höchsten vorhandenen Bestandsnummern, damit NumberSequenceService::next()
 * nahtlos an bestehende Rechnungen/Belege/Angebote/Aufträge/Lieferscheine
 * anschließt (kein Duplikat/keine Kollision mit bereits vergebenen Nummern).
 * journal_entries.journal_number ist zu diesem Zeitpunkt komplett neu und
 * überall NULL - dafür wird bewusst KEINE Sequence-Zeile vorab angelegt;
 * NumberSequenceService::next('journal', 0) erzeugt sie beim ersten Aufruf
 * selbst mit last_number=0 (Spec: "journal startet bei 0").
 *
 * DB::table(...)-Queries umgehen bewusst Eloquent-Global-Scopes/SoftDeletes,
 * damit auch soft-gelöschte Datensätze (Quote/Order/DeliveryNote/Beleg nutzen
 * SoftDeletes) in die Höchstnummer einfließen - exakt das Verhalten, das die
 * bisherigen Controller mit withTrashed() beim "max+1" absichtlich hatten
 * (sonst könnte eine neu vergebene Nummer mit einer soft-gelöschten Alt-Nummer
 * kollidieren).
 */
return new class extends Migration
{
    /**
     * @var array<string, array{table: string, column: string, prefix: string, format: string}>
     */
    private const DOCUMENT_TYPES = [
        'invoice' => ['table' => 'invoices', 'column' => 'invoice_number', 'prefix' => 'RE', 'format' => 'RE-{YYYY}-{NNNN}'],
        'quote' => ['table' => 'quotes', 'column' => 'quote_number', 'prefix' => 'AN', 'format' => 'AN-{YYYY}-{NNNN}'],
        'order' => ['table' => 'orders', 'column' => 'order_number', 'prefix' => 'AB', 'format' => 'AB-{YYYY}-{NNNN}'],
        'delivery_note' => ['table' => 'delivery_notes', 'column' => 'delivery_note_number', 'prefix' => 'LS', 'format' => 'LS-{YYYY}-{NNNN}'],
        'beleg' => ['table' => 'belege', 'column' => 'document_number', 'prefix' => 'BEL', 'format' => 'BEL-{YYYY}-{NNNN}'],
    ];

    public function up(): void
    {
        foreach (self::DOCUMENT_TYPES as $type => $config) {
            $this->backfillType($type, $config['table'], $config['column'], $config['prefix'], $config['format']);
        }
    }

    public function down(): void
    {
        // Reine Datenmigration (kein Schema-Wechsel hier) - number_sequences
        // selbst wird von der create-Migration entfernt, kein Rollback nötig.
    }

    private function backfillType(string $type, string $table, string $column, string $prefix, string $format): void
    {
        if (! \Illuminate\Support\Facades\Schema::hasTable($table)) {
            return;
        }

        $rows = DB::table($table)->select('tenant_id', $column)->get();

        // [tenant_id][year] => max last_number
        $maxByTenantYear = [];

        $pattern = '/^'.preg_quote($prefix, '/').'-(\d{4})-(\d+)$/';

        foreach ($rows as $row) {
            $number = $row->{$column};
            if (! $number || ! preg_match($pattern, $number, $matches)) {
                continue;
            }

            $year = (int) $matches[1];
            $seq = (int) $matches[2];

            $maxByTenantYear[$row->tenant_id][$year] = max(
                $maxByTenantYear[$row->tenant_id][$year] ?? 0,
                $seq
            );
        }

        foreach ($maxByTenantYear as $tenantId => $years) {
            foreach ($years as $year => $lastNumber) {
                DB::table('number_sequences')->updateOrInsert(
                    ['tenant_id' => $tenantId, 'type' => $type, 'year' => $year],
                    [
                        'public_id' => (string) Str::uuid(),
                        'last_number' => $lastNumber,
                        'format' => $format,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }
        }
    }
};
