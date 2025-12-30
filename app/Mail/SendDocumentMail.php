<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Queue\SerializesModels;

class SendDocumentMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $emailSubject;
    public string $emailBody;
    public string $signature;
    public ?string $pdfPath;
    public string $pdfName;

    /**
     * Create a new message instance.
     */
    public function __construct(
        string $subject,
        string $body,
        string $signature = '',
        ?string $pdfPath = null,
        string $pdfName = 'document.pdf'
    ) {
        $this->emailSubject = $subject;
        $this->emailBody = $body;
        $this->signature = $signature;
        $this->pdfPath = $pdfPath;
        $this->pdfName = $pdfName;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->emailSubject,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.document',
            with: [
                'body' => $this->emailBody,
                'signature' => $this->signature,
            ],
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        if ($this->pdfPath && file_exists($this->pdfPath)) {
            return [
                Attachment::fromPath($this->pdfPath)
                    ->as($this->pdfName)
                    ->withMime('application/pdf'),
            ];
        }

        return [];
    }
}
