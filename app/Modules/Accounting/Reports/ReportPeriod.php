<?php

namespace App\Modules\Accounting\Reports;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use InvalidArgumentException;

class ReportPeriod
{
    public const BASIS_POSTED = 'posted';

    public const BASIS_PREVIEW = 'preview';

    public function __construct(
        public readonly CarbonImmutable $from,
        public readonly CarbonImmutable $to,
        public readonly string $basis = self::BASIS_POSTED,
    ) {
        if (! in_array($this->basis, [self::BASIS_POSTED, self::BASIS_PREVIEW], true)) {
            throw new InvalidArgumentException('Ungültige Berichtsgrundlage.');
        }

        if ($this->from->greaterThan($this->to)) {
            throw new InvalidArgumentException('Das Von-Datum darf nicht nach dem Bis-Datum liegen.');
        }

        if ($this->from->isFuture() || $this->to->isFuture()) {
            throw new InvalidArgumentException('Berichtszeiträume dürfen nicht in der Zukunft liegen.');
        }
    }

    public static function fromRequest(Request $request): self
    {
        return new self(
            CarbonImmutable::parse($request->input('from_date', now()->startOfYear()->toDateString()))->startOfDay(),
            CarbonImmutable::parse($request->input('to_date', now()->endOfDay()->toDateString()))->startOfDay(),
            $request->input('basis', self::BASIS_POSTED),
        );
    }

    /**
     * @return array<int, string>
     */
    public function statuses(): array
    {
        return $this->basis === self::BASIS_PREVIEW
            ? ['posted', 'cancelled', 'draft']
            : ['posted', 'cancelled'];
    }

    /**
     * @return array{from: string, to: string}
     */
    public function toArray(): array
    {
        return [
            'from' => $this->from->toDateString(),
            'to' => $this->to->toDateString(),
        ];
    }
}
