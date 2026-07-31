<?php

namespace App\Services\Backup\Transformers;

/**
 * Registry for entity transformers.
 */
class EntityTransformerRegistry
{
    /**
     * Mapping of entity types to transformer classes.
     */
    protected array $transformers = [];

    public function __construct()
    {
        $this->registerDefaultTransformers();
    }

    /**
     * Register the default transformers.
     */
    protected function registerDefaultTransformers(): void
    {
        $this->transformers = [
            'tenants' => TenantTransformer::class,
            'users' => UserTransformer::class,
            'accounts' => AccountTransformer::class,
            'tax_codes' => TaxCodeTransformer::class,
            'report_account_mappings' => ReportAccountMappingTransformer::class,
            'product_categories' => ProductCategoryTransformer::class,
            'products' => ProductTransformer::class,
            'contacts' => ContactTransformer::class,
            'bank_accounts' => BankAccountTransformer::class,
            'bank_import_batches' => BankImportBatchTransformer::class,
            'bank_matching_rules' => BankMatchingRuleTransformer::class,
            'company_settings' => CompanySettingTransformer::class,
            // SPEC-08 (Teil A): Dimensionen VOR den Belegketten registrieren
            // (quotes/orders/invoices/belege/journal_entries referenzieren sie über
            // project_public_id/cost_center_public_id/cost_object_public_id).
            'cost_centers' => CostCenterTransformer::class,
            'cost_objects' => CostObjectTransformer::class,
            'projects' => ProjectTransformer::class,
            'quotes' => QuoteTransformer::class,
            'quote_lines' => QuoteLineTransformer::class,
            'orders' => OrderTransformer::class,
            'order_lines' => OrderLineTransformer::class,
            'delivery_notes' => DeliveryNoteTransformer::class,
            'delivery_note_lines' => DeliveryNoteLineTransformer::class,
            'invoices' => InvoiceTransformer::class,
            'invoice_lines' => InvoiceLineTransformer::class,
            'belege' => BelegTransformer::class,
            'beleg_lines' => BelegLineTransformer::class,
            'journal_entries' => JournalEntryTransformer::class,
            'journal_entry_lines' => JournalEntryLineTransformer::class,
            'bank_transactions' => BankTransactionTransformer::class,
            'payments' => PaymentTransformer::class,
            'inventory_transactions' => InventoryTransactionTransformer::class,
            // Note: 'documents' excluded - uses morph relationship without direct tenant_id
            // SPEC-06: audit_logs bewusst ZULETZT registriert - ein Audit-Eintrag
            // kann auf jede andere Entity oben verweisen (siehe AuditLogTransformer).
            'audit_logs' => AuditLogTransformer::class,
        ];
    }

    /**
     * Register a transformer for an entity type.
     */
    public function register(string $entityType, string $transformerClass): void
    {
        $this->transformers[$entityType] = $transformerClass;
    }

    /**
     * Get a transformer instance for an entity type.
     */
    public function getTransformer(string $entityType): ?BaseTransformer
    {
        if (! isset($this->transformers[$entityType])) {
            return null;
        }

        $class = $this->transformers[$entityType];

        if (! class_exists($class)) {
            return null;
        }

        return app($class);
    }

    /**
     * Check if a transformer exists for an entity type.
     */
    public function hasTransformer(string $entityType): bool
    {
        return isset($this->transformers[$entityType]) &&
               class_exists($this->transformers[$entityType]);
    }

    /**
     * Get all registered entity types.
     */
    public function getEntityTypes(): array
    {
        return array_keys($this->transformers);
    }
}
