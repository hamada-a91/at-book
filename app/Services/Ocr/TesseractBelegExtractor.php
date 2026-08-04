<?php

namespace App\Services\Ocr;

use App\Models\Beleg;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Smalot\PdfParser\Parser as PdfParser;
use Symfony\Component\Process\Process;
use thiagoalessio\TesseractOCR\TesseractOCR;

class TesseractBelegExtractor implements DocumentExtractor
{
    public function __construct(
        private readonly BelegOcrParser $parser,
        private readonly PdfParser $pdfParser = new PdfParser,
    ) {}

    public function extract(Beleg $beleg): array
    {
        if (! $beleg->file_path || ! Storage::disk('public')->exists($beleg->file_path)) {
            throw new RuntimeException('Belegdatei wurde nicht gefunden.');
        }

        $path = Storage::disk('public')->path($beleg->file_path);
        $extension = mb_strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $source = 'tesseract';

        if ($extension === 'pdf') {
            $text = $this->extractPdfTextLayer($path);
            if ($this->hasUsableText($text)) {
                $source = 'pdf-text-layer';
            } else {
                $text = $this->extractPdfViaTesseract($path);
            }
        } else {
            $text = $this->extractImageViaTesseract($path);
        }

        $parsed = $this->parser->parse($text);
        $rawText = mb_substr($text, 0, 12000);

        return [
            'provider' => 'tesseract',
            'source' => $source,
            'raw_text' => $rawText,
            'raw_text_truncated' => mb_strlen($text) > mb_strlen($rawText),
            ...$parsed,
        ];
    }

    private function extractPdfTextLayer(string $path): string
    {
        try {
            return trim($this->pdfParser->parseFile($path)->getText());
        } catch (\Throwable) {
            return '';
        }
    }

    private function hasUsableText(string $text): bool
    {
        $letters = preg_match_all('/[[:alpha:]]/u', $text);

        return mb_strlen(trim($text)) >= 80 && $letters >= 30;
    }

    private function extractPdfViaTesseract(string $path): string
    {
        $this->assertCommandAvailable('pdftoppm');
        $this->assertCommandAvailable('tesseract');

        $workDir = sys_get_temp_dir().'/at-book-ocr-'.bin2hex(random_bytes(8));
        if (! mkdir($workDir, 0700, true) && ! is_dir($workDir)) {
            throw new RuntimeException('OCR-Arbeitsverzeichnis konnte nicht erstellt werden.');
        }

        try {
            $prefix = $workDir.'/page';
            $process = new Process(['pdftoppm', '-f', '1', '-l', '3', '-r', '300', '-png', $path, $prefix]);
            $process->setTimeout(90);
            $process->run();

            if (! $process->isSuccessful()) {
                throw new RuntimeException('PDF konnte nicht fuer OCR gerendert werden: '.$process->getErrorOutput());
            }

            $images = glob($workDir.'/page-*.png') ?: [];
            sort($images);

            if ($images === []) {
                throw new RuntimeException('PDF-Rendering hat keine Seitenbilder erzeugt.');
            }

            return implode("\n\n", array_map(fn (string $image) => $this->extractImageViaTesseract($image), $images));
        } finally {
            foreach (glob($workDir.'/*') ?: [] as $file) {
                @unlink($file);
            }
            @rmdir($workDir);
        }
    }

    private function extractImageViaTesseract(string $path): string
    {
        $this->assertCommandAvailable('tesseract');

        try {
            return trim((new TesseractOCR($path))
                ->lang('deu')
                ->psm(6)
                ->run());
        } catch (\Throwable $exception) {
            throw new RuntimeException('Tesseract-OCR fehlgeschlagen: '.$exception->getMessage(), 0, $exception);
        }
    }

    private function assertCommandAvailable(string $command): void
    {
        $process = new Process(['which', $command]);
        $process->setTimeout(5);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new RuntimeException("Systempaket '{$command}' ist im Container nicht verfuegbar.");
        }
    }
}
