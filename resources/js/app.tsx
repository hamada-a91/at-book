import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Dashboard } from './pages/Dashboard';
import { AccountsList } from './pages/AccountsList';
import { AccountCreate } from './pages/AccountCreate';
import { AccountDetail } from './pages/AccountDetail';
import { JournalList } from './pages/JournalList';
import { BookingCreate } from './pages/BookingCreate';
import { ContactsList } from './pages/ContactsList';
import { InvoicesList } from './pages/InvoicesList';
import { InvoiceCreate } from './pages/InvoiceCreate';
import { InvoicePreview } from './pages/InvoicePreview';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { BelegeList } from './pages/BelegeList';
import { BelegCreate } from './pages/BelegCreate';
import { BelegView } from './pages/BelegView';
import { MainLayout } from '@/components/layout/main-layout';
import { ThemeProvider } from '@/components/theme-provider';
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
            <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                <BrowserRouter>
                    <MainLayout>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/accounts" element={<AccountsList />} />
                            <Route path="/accounts/create" element={<AccountCreate />} />
                            <Route path="/accounts/:id" element={<AccountDetail />} />
                            <Route path="/contacts" element={<ContactsList />} />
                            <Route path="/invoices" element={<InvoicesList />} />
                            <Route path="/invoices/create" element={<InvoiceCreate />} />
                            <Route path="/invoices/:id/preview" element={<InvoicePreview />} />
                            <Route path="/invoices/:id/edit" element={<InvoiceCreate />} />
                            <Route path="/belege" element={<BelegeList />} />
                            <Route path="/belege/create" element={<BelegCreate />} />
                            <Route path="/belege/:id" element={<BelegView />} />
                            <Route path="/belege/:id/edit" element={<BelegCreate />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/journal" element={<Navigate to="/reports" replace />} />
                            <Route path="/bookings" element={<JournalList />} />
                            <Route path="/bookings/create" element={<BookingCreate />} />
                            <Route path="/settings" element={<Settings />} />
                        </Routes>
                    </MainLayout>
                </BrowserRouter>
            </ThemeProvider>
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
