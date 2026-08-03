<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SupportMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $userName;

    public string $userEmail;

    public ?string $tenantName;

    public ?string $tenantSlug;

    public string $supportSubject;

    public string $supportMessage;

    /**
     * Create a new message instance.
     */
    public function __construct(
        string $userName,
        string $userEmail,
        ?string $tenantName,
        ?string $tenantSlug,
        string $subject,
        string $message
    ) {
        $this->userName = $userName;
        $this->userEmail = $userEmail;
        $this->tenantName = $tenantName;
        $this->tenantSlug = $tenantSlug;
        $this->supportSubject = $subject;
        $this->supportMessage = $message;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        $subjectText = 'Support Anfrage: '.$this->supportSubject;
        if ($this->tenantName) {
            $subjectText .= ' [Tenant: '.$this->tenantName.']';
        }

        return new Envelope(
            subject: $subjectText,
            replyTo: [
                new \Illuminate\Mail\Mailables\Address($this->userEmail, $this->userName),
            ],
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.support',
            with: [
                'userName' => $this->userName,
                'userEmail' => $this->userEmail,
                'tenantName' => $this->tenantName,
                'tenantSlug' => $this->tenantSlug,
                'supportSubject' => $this->supportSubject,
                'supportMessage' => $this->supportMessage,
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
        return [];
    }
}
