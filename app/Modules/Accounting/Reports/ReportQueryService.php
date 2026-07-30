<?php

namespace App\Modules\Accounting\Reports;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReportQueryService
{
    public function tenantId(): int
    {
        $tenant = tenant();

        if (! $tenant) {
            throw new RuntimeException('Kein Tenant-Kontext für Bericht verfügbar.');
        }

        return (int) $tenant->id;
    }

    public function accountPeriodSums(ReportPeriod $period): Collection
    {
        return $this->lineQuery($period)
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->selectRaw("
                accounts.id as account_id,
                accounts.code,
                accounts.name,
                accounts.type as account_type,
                accounts.category,
                coalesce(sum(case when journal_entry_lines.type = 'debit' then journal_entry_lines.amount else 0 end), 0) as debit,
                coalesce(sum(case when journal_entry_lines.type = 'credit' then journal_entry_lines.amount else 0 end), 0) as credit
            ")
            ->groupBy('accounts.id', 'accounts.code', 'accounts.name', 'accounts.type', 'accounts.category')
            ->orderBy('accounts.code')
            ->get();
    }

    public function accountOpeningSums(ReportPeriod $period): Collection
    {
        return $this->lineQuery($period)
            ->whereDate('journal_entries.booking_date', '<', $period->from->toDateString())
            ->selectRaw("
                accounts.id as account_id,
                coalesce(sum(case when journal_entry_lines.type = 'debit' then journal_entry_lines.amount else 0 end), 0) as debit,
                coalesce(sum(case when journal_entry_lines.type = 'credit' then journal_entry_lines.amount else 0 end), 0) as credit
            ")
            ->groupBy('accounts.id')
            ->get()
            ->keyBy('account_id');
    }

    public function balanceSums(ReportPeriod $period): Collection
    {
        return $this->lineQuery($period)
            ->whereDate('journal_entries.booking_date', '<=', $period->to->toDateString())
            ->selectRaw("
                accounts.id as account_id,
                accounts.code,
                accounts.name,
                accounts.type as account_type,
                accounts.category,
                coalesce(sum(case when journal_entry_lines.type = 'debit' then journal_entry_lines.amount else 0 end), 0) as debit,
                coalesce(sum(case when journal_entry_lines.type = 'credit' then journal_entry_lines.amount else 0 end), 0) as credit
            ")
            ->groupBy('accounts.id', 'accounts.code', 'accounts.name', 'accounts.type', 'accounts.category')
            ->orderBy('accounts.code')
            ->get();
    }

    public function journalRows(ReportPeriod $period, int $perPage = 250): Collection
    {
        return $this->lineQuery($period)
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->select([
                'journal_entries.id as entry_id',
                'journal_entries.public_id as entry_public_id',
                'journal_entries.booking_date',
                'journal_entries.journal_number',
                'journal_entries.description',
                'journal_entries.status',
                'journal_entry_lines.id as line_id',
                'journal_entry_lines.type',
                'journal_entry_lines.amount',
                'accounts.id as account_id',
                'accounts.code as account_code',
                'accounts.name as account_name',
            ])
            ->orderBy('journal_entries.booking_date')
            ->orderBy('journal_entries.id')
            ->orderBy('journal_entry_lines.id')
            ->limit($perPage)
            ->get();
    }

    public function accountMovementRows(ReportPeriod $period, int $accountId): Collection
    {
        return $this->lineQuery($period)
            ->where('accounts.id', $accountId)
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->select([
                'journal_entries.id as entry_id',
                'journal_entries.public_id as entry_public_id',
                'journal_entries.booking_date',
                'journal_entries.journal_number',
                'journal_entries.description',
                'journal_entries.status',
                'journal_entry_lines.id as line_id',
                'journal_entry_lines.type',
                'journal_entry_lines.amount',
            ])
            ->orderBy('journal_entries.booking_date')
            ->orderBy('journal_entries.id')
            ->orderBy('journal_entry_lines.id')
            ->get();
    }

    public function vatRows(ReportPeriod $period): Collection
    {
        return $this->lineQuery($period)
            ->whereBetween('journal_entries.booking_date', [$period->from->toDateString(), $period->to->toDateString()])
            ->where(function (Builder $query) {
                $query->whereNotNull('journal_entry_lines.tax_key')
                    ->orWhere('journal_entry_lines.tax_amount', '!=', 0);
            })
            ->selectRaw("
                coalesce(journal_entry_lines.tax_key, 'OHNE_STEUERSCHLUESSEL') as tax_key,
                accounts.type as account_type,
                count(*) as count,
                coalesce(sum(journal_entry_lines.amount), 0) as base_amount,
                coalesce(sum(journal_entry_lines.tax_amount), 0) as tax_amount
            ")
            ->groupBy('journal_entry_lines.tax_key', 'accounts.type')
            ->orderBy('tax_key')
            ->get();
    }

    public function lineQuery(ReportPeriod $period): Builder
    {
        return DB::table('journal_entry_lines')
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->join('accounts', 'accounts.id', '=', 'journal_entry_lines.account_id')
            ->whereNull('journal_entries.deleted_at')
            ->where('journal_entries.tenant_id', $this->tenantId())
            ->where('accounts.tenant_id', $this->tenantId())
            ->whereIn('journal_entries.status', $period->statuses());
    }
}
