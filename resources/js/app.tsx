import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './pages/Dashboard';
import { AccountsList } from './pages/AccountsList';
import { AccountCreate } from './pages/AccountCreate';
import { JournalList } from './pages/JournalList';
import { BookingCreate } from './pages/BookingCreate';
import { ContactsList } from './pages/ContactsList';
import { InvoicesList } from './pages/InvoicesList';
import { InvoiceCreate } from './pages/InvoiceCreate';
import { InvoicePreview } from './pages/InvoicePreview';
import { Settings } from './pages/Settings';
import '../css/app.css';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/accounts" element={<AccountsList />} />
                    <Route path="/accounts/create" element={<AccountCreate />} />
                    <Route path="/contacts" element={<ContactsList />} />
                    <Route path="/invoices" element={<InvoicesList />} />
                    <Route path="/invoices/create" element={<InvoiceCreate />} />
                    <Route path="/invoices/:id/preview" element={<InvoicePreview />} />
                    <Route path="/invoices/:id/edit" element={<InvoiceCreate />} />
                    <Route path="/bookings" element={<JournalList />} />
                    <Route path="/bookings/create" element={<BookingCreate />} />
                    <Route path="/settings" element={<Settings />} />
                </Routes>
            </BrowserRouter>
        </QueryClientProvider>
    );
}

const root = document.getElementById('app');
if (root) {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
