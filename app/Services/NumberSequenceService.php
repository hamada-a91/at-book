<?php

namespace App\Services;

use App\Models\NumberSequence;
use DomainException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * SPEC-05 (Teil A): Race-freie, pro Tenant lückenlose Nummernvergabe.
 *
 * WICHTIG: next() MUSS innerhalb einer bestehenden DB::transaction() des
 * Aufrufers laufen (lockForUpdate() hält seine Sperre nur bis zum Ende der
 * umgebenden Transaktion - außerhalb einer Transaktion verpufft der Lock
 * sofort nach dem SELECT und die Serialisierung parallele Vergaben wäre
 * wirkungslos).
 *
 * Lückenlosigkeit durch Vergabezeitpunkt: next() wird erst aufgerufen, wenn
 * das Dokument tatsächlich entsteht (Rechnung/Beleg/Angebot/Auftrag/
 * Lieferschein bei Erstellung) bzw. festgeschrieben wird (Journalbuchung bei
 * lockBooking()) - nie für verworfene Drafts.
 */
class NumberSequenceService
{
    /**
     * Standard-Formate je Dokumenttyp. Aus dem bestehenden Code übernommen
     * (siehe vormalige "max+1"-Logik in den jeweiligen Controllern) - NICHT
     * neu erfunden, damit sich das sichtbare Nummernformat für Bestandskunden
     * nicht ändert. 'journal' ist neu (siehe SPEC-05, Teil A) und nutzt bewusst
     * kein {YYYY} (year=0, jahresunabhängig fortlaufend) sowie eine 6-stellige
     * statt 4-stellige Zählnummer, da die Journalnummer nie auf 0001 zurückspringt
     * und über viele Jahre hinweg wächst.
     */
    public const DEFAULT_FORMATS = [
        'invoice' => 'RE-{YYYY}-{NNNN}',
        'quote' => 'AN-{YYYY}-{NNNN}',
        'order' => 'AB-{YYYY}-{NNNN}',
        'delivery_note' => 'LS-{YYYY}-{NNNN}',
        'beleg' => 'BEL-{YYYY}-{NNNN}',
        'journal' => 'J-{NNNNNN}',
    ];

    /**
     * Zieht die nächste Nummer für $type (und optional $year, Default:
     * aktuelles Jahr) und gibt sie formatiert zurück.
     *
     * @throws DomainException wenn kein Mandanten-Kontext gesetzt ist.
     */
    public function next(string $type, ?int $year = null): string
    {
        $tenant = tenant();
        if (! $tenant) {
            throw new DomainException('Nummernkreis-Vergabe erfordert einen Mandanten-Kontext.');
        }

        $resolvedYear = $year ?? (int) date('Y');

        $sequence = $this->lockedSequence($tenant->id, $type, $resolvedYear);

        if (! $sequence) {
            // Erstanlage des Nummernkreises. Ein nested DB::transaction() erzeugt in
            // Postgres ein echtes SAVEPOINT - konkurriert eine parallele Transaktion
            // ebenfalls um die Erstanlage, rollt nur dieses SAVEPOINT zurück (nicht die
            // äußere Transaktion des next()-Aufrufers), die Unique-Constraint-Verletzung
            // wird sauber abgefangen und der Gewinner der Race per erneutem SELECT ...
            // FOR UPDATE gelesen.
            try {
                DB::transaction(function () use ($tenant, $type, $resolvedYear) {
                    NumberSequence::create([
                        'tenant_id' => $tenant->id,
                        'type' => $type,
                        'year' => $resolvedYear,
                        'last_number' => 0,
                        'format' => self::DEFAULT_FORMATS[$type] ?? self::DEFAULT_FORMATS['invoice'],
                    ]);
                });
            } catch (QueryException $e) {
                // Ein paralleler Aufruf hat den Nummernkreis bereits angelegt (Unique-
                // Constraint tenant_id/type/year) - unten wird die gewinnende Zeile gelesen.
            }

            $sequence = $this->lockedSequence($tenant->id, $type, $resolvedYear);
        }

        if (! $sequence) {
            throw new DomainException("Nummernkreis für '{$type}' konnte nicht angelegt werden.");
        }

        $sequence->increment('last_number');

        return $this->format($sequence->fresh());
    }

    private function lockedSequence(int $tenantId, string $type, int $year): ?NumberSequence
    {
        return NumberSequence::where('tenant_id', $tenantId)
            ->where('type', $type)
            ->where('year', $year)
            ->lockForUpdate()
            ->first();
    }

    /**
     * Formatiert eine Sequenz-Zeile anhand ihres 'format'-Templates:
     * - {YYYY} -> vierstelliges Jahr (leer, wenn year=0, z.B. beim Journal-Kreis)
     * - {N...} -> laufende Nummer, links mit Nullen aufgefüllt auf die Anzahl der
     *             'N'-Zeichen im Platzhalter (z.B. {NNNN} -> 4-stellig, {NNNNNN} -> 6-stellig)
     */
    private function format(NumberSequence $sequence): string
    {
        $value = $sequence->format;

        $value = str_replace('{YYYY}', $sequence->year > 0 ? (string) $sequence->year : '', $value);

        return preg_replace_callback(
            '/\{(N+)\}/',
            fn (array $matches) => str_pad((string) $sequence->last_number, strlen($matches[1]), '0', STR_PAD_LEFT),
            $value
        );
    }
}
