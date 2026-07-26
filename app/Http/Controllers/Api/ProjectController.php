<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Concerns\HasTenantScope;
use App\Http\Controllers\Controller;
use App\Modules\Accounting\Models\JournalEntryLine;
use App\Modules\Projects\Models\CostObject;
use App\Modules\Projects\Models\Project;
use App\Modules\Projects\Services\ProjectReportService;
use App\Rules\TenantExists;
use App\Services\NumberSequenceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * SPEC-08 (Teil A): Projekt-CRUD + Auswertungs-Endpunkte (JSON, siehe
 * ProjectReportService). PDF/E-Mail-Versand des Kosten-Nachweises ist Teil B
 * (siehe TODO-Kommentare in routes/api.php) - hier bewusst NICHT
 * implementiert.
 */
class ProjectController extends Controller
{
    use HasTenantScope;

    public function __construct(
        private NumberSequenceService $numberSequenceService,
        private ProjectReportService $projectReportService,
    ) {}

    public function index(Request $request)
    {
        $tenant = $this->getTenantOrFail();
        $query = Project::where('tenant_id', $tenant->id)->with(['contact', 'costObject']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->orderBy('number', 'desc')->get());
    }

    /**
     * Anlage: Nummernvergabe (NumberSequenceService, Typ 'project') UND das
     * automatische Anlegen des dedizierten Kostenträgers (Name = Projektname,
     * Code = Projektnummer - garantiert eindeutig je Tenant, siehe
     * cost_objects.unique(tenant_id, code)) laufen in EINER DB::transaction()
     * (siehe Project-Model-Docblock für die Begründung, warum das hier im
     * Controller statt in einem Model-Hook passiert).
     */
    public function store(Request $request)
    {
        $tenant = $this->getTenantOrFail();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_id' => ['nullable', new TenantExists('contacts')],
            'budget_amount' => 'nullable|integer|min:0',
            'starts_on' => 'nullable|date',
            'ends_on' => 'nullable|date|after_or_equal:starts_on',
            'status' => 'nullable|in:active,completed,archived',
            'notes' => 'nullable|string',
        ]);

        $project = DB::transaction(function () use ($validated, $tenant) {
            $projectNumber = $this->numberSequenceService->next('project');

            $costObject = CostObject::create([
                'tenant_id' => $tenant->id,
                'code' => $projectNumber,
                'name' => $validated['name'],
                'active' => true,
            ]);

            return Project::create([
                'tenant_id' => $tenant->id,
                'number' => $projectNumber,
                'name' => $validated['name'],
                'contact_id' => $validated['contact_id'] ?? null,
                'cost_object_id' => $costObject->id,
                'budget_amount' => $validated['budget_amount'] ?? null,
                'starts_on' => $validated['starts_on'] ?? null,
                'ends_on' => $validated['ends_on'] ?? null,
                'status' => $validated['status'] ?? 'active',
                'notes' => $validated['notes'] ?? null,
            ]);
        });

        return response()->json($project->load(['contact', 'costObject']), 201);
    }

    public function show(Project $project)
    {
        return response()->json($project->load(['contact', 'costObject']));
    }

    /**
     * number/cost_object_id sind bewusst NICHT änderbar (Nummer ist
     * lückenlos vergeben, der Kostenträger ist die dedizierte 1:1-Dimension
     * des Projekts). Der Kostenträger-Name wird bei einer Namensänderung des
     * Projekts synchron mitgeführt, damit KOST2-Auswertungen weiterhin einen
     * sprechenden Namen zeigen.
     */
    public function update(Request $request, Project $project)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_id' => ['nullable', new TenantExists('contacts')],
            'budget_amount' => 'nullable|integer|min:0',
            'starts_on' => 'nullable|date',
            'ends_on' => 'nullable|date|after_or_equal:starts_on',
            'status' => 'nullable|in:active,completed,archived',
            'notes' => 'nullable|string',
        ]);

        DB::transaction(function () use ($validated, $project) {
            $project->update([
                'name' => $validated['name'],
                'contact_id' => $validated['contact_id'] ?? null,
                'budget_amount' => $validated['budget_amount'] ?? null,
                'starts_on' => $validated['starts_on'] ?? null,
                'ends_on' => $validated['ends_on'] ?? null,
                'status' => $validated['status'] ?? $project->status,
                'notes' => $validated['notes'] ?? null,
            ]);

            if ($project->costObject && $project->costObject->name !== $validated['name']) {
                $project->costObject->update(['name' => $validated['name']]);
            }
        });

        return response()->json($project->fresh()->load(['contact', 'costObject']));
    }

    /**
     * Löschen nur, solange der dedizierte Kostenträger keine Buchungen trägt
     * - sonst 422, Hinweis auf Archivieren (status=archived) statt Löschen.
     * Beim Löschen wird der dedizierte Kostenträger mitgelöscht (1:1-Bindung,
     * siehe store()); Dokumente, die project_id auf dieses Projekt gesetzt
     * hatten, verlieren die Zuordnung (project_id -> null, DB-seitig per
     * nullOnDelete, siehe Migration).
     */
    public function destroy(Project $project)
    {
        if (JournalEntryLine::where('cost_object_id', $project->cost_object_id)->exists()) {
            return response()->json([
                'error' => 'Für dieses Projekt liegen bereits Buchungen vor - es kann nicht gelöscht werden. Bitte archivieren Sie es stattdessen (Status "archived").',
            ], 422);
        }

        DB::transaction(function () use ($project) {
            $costObject = $project->costObject;
            $project->delete();
            $costObject?->delete();
        });

        return response()->json(['message' => 'Projekt gelöscht']);
    }

    /**
     * GET /projects/{project}/summary - Budget vs. Ist.
     */
    public function summary(Project $project)
    {
        return response()->json($this->projectReportService->summary($project));
    }

    /**
     * GET /projects/{project}/entries?from&to - alle Buchungen des Projekts
     * (für die Detail-Ansicht) - bewusst ALLE Status (auch draft), da dies
     * eine reine Listen-/Nachvollzieh-Ansicht ist, kein aufsummierter Report
     * (im Gegensatz zu summary()/costReport(), die dem Reports-Prinzip
     * "posted+cancelled" folgen).
     */
    public function entries(Request $request, Project $project)
    {
        $query = JournalEntryLine::with(['account', 'journalEntry.beleg'])
            ->where('cost_object_id', $project->cost_object_id)
            ->whereHas('journalEntry', function ($q) use ($request) {
                if ($request->filled('from')) {
                    $q->whereDate('booking_date', '>=', $request->input('from'));
                }
                if ($request->filled('to')) {
                    $q->whereDate('booking_date', '<=', $request->input('to'));
                }
            });

        $lines = $query->get()
            ->sortBy(fn (JournalEntryLine $line) => $line->journalEntry->booking_date.'-'.$line->journalEntry->id)
            ->values()
            ->map(function (JournalEntryLine $line) {
                return [
                    'journal_entry_id' => $line->journalEntry->id,
                    'journal_number' => $line->journalEntry->journal_number,
                    'booking_date' => $line->journalEntry->booking_date?->toDateString(),
                    'document_number' => $line->journalEntry->beleg?->document_number,
                    'description' => $line->journalEntry->description,
                    'status' => $line->journalEntry->status,
                    'account_code' => $line->account?->code,
                    'account_name' => $line->account?->name,
                    'account_type' => $line->account?->type,
                    'type' => $line->type,
                    'amount' => $line->amount,
                    'tax_amount' => $line->tax_amount,
                    'cost_center_id' => $line->cost_center_id,
                ];
            });

        return response()->json([
            'project_id' => $project->id,
            'from' => $request->input('from'),
            'to' => $request->input('to'),
            'entries' => $lines,
        ]);
    }

    /**
     * GET /projects/{project}/cost-report?from&to - Kosten-Nachweis als JSON
     * (Netto/USt/Brutto je Kostenbuchung + Summenzeile). PDF-Rendering ist
     * Teil B.
     */
    public function costReport(Request $request, Project $project)
    {
        $this->assertOwnedByTenant($project);

        return response()->json($this->projectReportService->costReport(
            $project,
            $request->input('from'),
            $request->input('to')
        ));
    }

    /**
     * GET /projects/{project}/cost-report/pdf?from&to - kundentauglicher
     * Kosten-Nachweis als PDF (nur Kosten, Netto/USt/Brutto, keine Erlöse).
     */
    public function costReportPdf(Request $request, Project $project)
    {
        $this->assertOwnedByTenant($project);

        $pdf = $this->renderCostReportPdf($project, $request->input('from'), $request->input('to'));

        return $pdf->download("Kosten-Nachweis-{$project->number}.pdf");
    }

    /**
     * POST /projects/{project}/cost-report/send - Kosten-Nachweis per E-Mail an
     * den Kunden (Muster: InvoiceController::send + SendDocumentMail).
     */
    public function costReportSend(Request $request, Project $project)
    {
        $this->assertOwnedByTenant($project);

        $validated = $request->validate([
            'to' => 'required|email',
            'cc' => 'nullable|email',
            'subject' => 'required|string',
            'body' => 'required|string',
            'signature' => 'nullable|string',
            'from' => 'nullable|date',
            'to_date' => 'nullable|date',
        ]);

        $pdf = $this->renderCostReportPdf($project, $request->input('from'), $request->input('to_date'));

        if (! is_dir(storage_path('app/temp'))) {
            mkdir(storage_path('app/temp'), 0755, true);
        }
        $pdfPath = storage_path("app/temp/kosten-nachweis-{$project->number}.pdf");
        $pdf->save($pdfPath);

        $mail = new \App\Mail\SendDocumentMail(
            $validated['subject'],
            $validated['body'],
            $validated['signature'] ?? '',
            $pdfPath,
            "Kosten-Nachweis-{$project->number}.pdf"
        );

        if (! empty($validated['cc'])) {
            \Illuminate\Support\Facades\Mail::to($validated['to'])->cc($validated['cc'])->send($mail);
        } else {
            \Illuminate\Support\Facades\Mail::to($validated['to'])->send($mail);
        }

        return response()->json(['message' => 'Kosten-Nachweis versendet.']);
    }

    private function renderCostReportPdf(Project $project, ?string $from, ?string $to): \Barryvdh\DomPDF\PDF
    {
        $project->load('contact');
        $report = $this->projectReportService->costReport($project, $from, $to);
        $settings = \App\Models\CompanySetting::first();

        return \Barryvdh\DomPDF\Facade\Pdf::loadView('projects.cost-report', [
            'project' => $project,
            'customer' => $project->contact,
            'report' => $report,
            'settings' => $settings,
        ])->setPaper('a4');
    }
}
