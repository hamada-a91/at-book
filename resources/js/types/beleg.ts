export type BelegType = 'ausgang' | 'eingang' | 'offen' | 'sonstige';
export type BelegStatus = 'draft' | 'booked' | 'paid' | 'cancelled';

export interface Beleg {
    id: number;
    document_number: string;
    document_type: BelegType;
    title: string;
    document_date: string;
    amount: number;
    tax_amount: number;
    contact_id: number | null;
    contact?: {
        id: number;
        name: string;
    };
    category_account_id: number | null;
    category_account?: {
        id: number;
        code: string;
        name: string;
    };
    is_paid: boolean;
    payment_account_id: number | null;
    payment_account?: {
        id: number;
        code: string;
        name: string;
    };
    journal_entry_id: number | null;
    journalEntry?: {
        id: number;
        description: string;
        booking_date: string;
    };
    file_path: string | null;
    file_name: string | null;
    notes: string | null;
    status: BelegStatus;
    due_date: string | null;
    created_at: string;
    updated_at: string;
}

export interface BelegFormData {
    document_type: BelegType;
    title: string;
    document_date: string;
    amount: number;
    tax_amount: number;
    contact_id: number | null;
    notes: string | null;
    due_date: string | null;
}
