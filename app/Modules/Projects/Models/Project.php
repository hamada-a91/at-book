<?php

namespace App\Modules\Projects\Models;

use App\Models\Concerns\BelongsToTenant;
use App\Models\Concerns\HasPublicId;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * SPEC-08 (Teil A): Projekt - Stammdaten-Klammer (Kunde, Budget, Laufzeit) mit
 * genau einem eigenen, automatisch angelegten Kostenträger (cost_object_id).
 *
 * contact_id ist bewusst NULLABLE: null = internes Projekt (z.B. eigenes
 * Produkt "BieneB", kein Kunde) - verhält sich fachlich identisch zu einem
 * Kundenprojekt (siehe SPEC-08, "Fachliches Modell").
 *
 * Anlage: die Nummernvergabe (NumberSequenceService, Typ 'project') UND das
 * automatische Anlegen des zugehörigen CostObject (Name = Projektname)
 * laufen bewusst NICHT in einem Model-Hook (creating()/created()), sondern in
 * App\Http\Controllers\Api\ProjectController::store() innerhalb EINER
 * DB::transaction() - analog zum bestehenden Muster in
 * InvoiceController/QuoteController/OrderController::store() (Nummernvergabe
 * ebenfalls im Controller, nicht im Model). Ein Model-Hook hätte hier
 * zusätzlich das Problem, dass cost_object_id NOT NULL ist (siehe Migration)
 * und das CostObject daher VOR dem eigentlichen Project::create() existieren
 * muss - im Controller ist diese Reihenfolge (CostObject zuerst, dann
 * Project mit cost_object_id) explizit und nachvollziehbar abgebildet.
 */
class Project extends Model
{
    use BelongsToTenant, HasPublicId;

    protected $fillable = [
        'number',
        'name',
        'contact_id',
        'cost_object_id',
        'budget_amount',
        'starts_on',
        'ends_on',
        'status',
        'notes',
    ];

    protected $casts = [
        'starts_on' => 'date',
        'ends_on' => 'date',
        'budget_amount' => 'integer',
    ];

    public function contact(): BelongsTo
    {
        return $this->belongsTo(\App\Modules\Contacts\Models\Contact::class);
    }

    public function costObject(): BelongsTo
    {
        return $this->belongsTo(CostObject::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(\App\Models\Invoice::class);
    }

    public function belege(): HasMany
    {
        return $this->hasMany(\App\Models\Beleg::class);
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(\App\Models\Quote::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(\App\Models\Order::class);
    }
}
