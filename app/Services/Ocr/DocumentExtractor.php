<?php

namespace App\Services\Ocr;

use App\Models\Beleg;

interface DocumentExtractor
{
    public function extract(Beleg $beleg): array;
}
