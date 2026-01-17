import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
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
import { BankAccountsList } from './pages/BankAccountsList';
import { QuotesList } from './pages/QuotesList';
import { QuoteCreate } from './pages/QuoteCreate';
import { OrdersList } from './pages/OrdersList';
import { OrderDetail } from './pages/OrderDetail';
import { QuotePreview } from './pages/QuotePreview';
import Onboarding from './pages/Onboarding';
import Welcome from './pages/Welcome';
import Register from './pages/Auth/Register';
import Login from './pages/Auth/Login';
import ProductList from './pages/Products/ProductList';
import ProductCreate from './pages/Products/ProductCreate';
import InventoryMovements from './pages/Products/InventoryMovements';
import UsersList from './pages/Users/UsersList';
import { MainLayout } from '@/components/layout/main-layout';
import { ThemeProvider } from '@/components/theme-provider';
import { useEffect, useState } from 'react';
import axios from '@/lib/axios';
import '../css/app.css';

// ============================================================================
// GLOBAL FETCH INTERCEPTOR - Automatically adds auth token to all API calls
// ============================================================================
const originalFetch = window.fetch;
window.fetch = function (...args: Parameters<typeof originalFetch>) {
    const [url, options = {}] = args;

    // Only intercept API calls
    if (typeof url === 'string' && url.startsWith('/api')) {
        const token = localStorage.getItem('auth_token');
        const headers = new Headers(options.headers || {});

        // Add auth token if available, BUT skip for public auth routes to prevent 401s from stale tokens
        const isPublicAuthRoute = url.endsWith('/login') || url.endsWith('/register');
        if (token && !isPublicAuthRoute) {
            console.log('🔐 Attaching auth token to request:', url);
            headers.set('Authorization', `Bearer ${token}`);
        } else {
            console.log('⚠️ No auth token attached or public route:', url, { hasToken: !!token, isPublic: isPublicAuthRoute });
        }

        // Always set Accept header for API calls
        headers.set('Accept', 'application/json');

        // Set Content-Type for JSON bodies
        if (options.body && typeof options.body === 'string') {
            headers.set('Content-Type', 'application/json');
        }

        options.headers = headers as HeadersInit;
        options.credentials = 'include'; // Include cookies for session auth
    }

    return originalFetch.apply(this, args).then(async (response) => {
        // Handle 401 Unauthorized - redirect to login
        if (response.status === 401 && typeof url === 'string' && url.startsWith('/api')) {
            console.warn('🔒 Unauthorized request to:', url);
            localStorage.removeItem('auth_token');
            window.location.href = '/login';
        }
        return response;
    });
};
// ============================================================================

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

// Redirect Component for Onboarding
function OnboardingCheck({ children }: { children: React.ReactNode }) {
    const [isChecking, setIsChecking] = useState(true);
    const [shouldRedirect, setShouldRedirect] = useState(false);
    const location = useLocation();
    const { tenant } = useParams();

    useEffect(() => {
        checkOnboarding();
    }, [location.pathname]);

    const checkOnboarding = async () => {
        // Allow onboarding and settings routes
        if (location.pathname.includes('/onboarding') || location.pathname.includes('/settings')) {
            setIsChecking(false);
            return;
        }

        // Check if we have a token before trying to use it
        const token = localStorage.getItem('auth_token');
        if (!token) {
            // No token, but we are supposed to be in a protected route?
            // Let the layout/wrappers handle auth redirects if needed.
            setIsChecking(false);
            return;
        }

        try {
            const { data } = await axios.get('/api/onboarding/status');
            console.log('📊 Onboarding Status:', data);

            if (!data.completed) {
                console.warn('⚠️ Redirecting to onboarding...');
                setShouldRedirect(true);
            }
        } catch (error) {
            console.error('Error checking onboarding:', error);
            // Don't redirect here, let the interceptor handle 401s if they occur
        } finally {
            setIsChecking(false);
        }
    };

    if (isChecking) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (shouldRedirect) {
        // Ensure we don't redirect if we are already there (redundant check but safe)
        if (!location.pathname.includes('/onboarding')) {
            window.location.href = `/${tenant}/onboarding`;
            return null;
        }
    }

    return <>{children}</>;
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
                <BrowserRouter>
                    <Routes>
                        {/* Public Routes (No Tenant) */}
                        <Route path="/" element={<Welcome />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/login" element={<Login />} />

                        {/* Tenant-Specific Routes */}
                        <Route path="/:tenant/*" element={<TenantRoutes />} />
                    </Routes>
                </BrowserRouter>
            </ThemeProvider>
        </QueryClientProvider>
    );
}

// Tenant-specific routes wrapper
function TenantRoutes() {
    const { tenant } = useParams();

    return (
        <Routes>
            {/* Onboarding Route - Standalone */}
            <Route path="/onboarding" element={<Onboarding />} />

            {/* All other routes with OnboardingCheck */}
            <Route path="/*" element={
                <OnboardingCheck>
                    <MainLayout>
                        <Routes>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/accounts" element={<AccountsList />} />
                            <Route path="/accounts/create" element={<AccountCreate />} />
                            <Route path="/accounts/:id" element={<AccountDetail />} />
                            <Route path="/contacts" element={<ContactsList />} />
                            <Route path="/products" element={<ProductList />} />
                            <Route path="/products/create" element={<ProductCreate />} />
                            <Route path="/products/:id/edit" element={<ProductCreate />} />
                            <Route path="/products/movements" element={<InventoryMovements />} />
                            <Route path="/inventory-report" element={<Navigate to={`/${tenant}/products/movements`} replace />} />
                            <Route path="/invoices" element={<InvoicesList />} />
                            <Route path="/invoices/create" element={<InvoiceCreate />} />
                            <Route path="/invoices/:id/preview" element={<InvoicePreview />} />
                            <Route path="/invoices/:id/edit" element={<InvoiceCreate />} />
                            <Route path="/quotes" element={<QuotesList />} />
                            <Route path="/quotes/create" element={<QuoteCreate />} />
                            <Route path="/quotes/:id" element={<QuotePreview />} />
                            <Route path="/quotes/:id/edit" element={<QuoteCreate />} />
                            <Route path="/orders" element={<OrdersList />} />
                            <Route path="/orders/:id" element={<OrderDetail />} />
                            <Route path="/orders/create" element={<QuoteCreate />} />
                            <Route path="/belege" element={<BelegeList />} />
                            <Route path="/belege/create" element={<BelegCreate />} />
                            <Route path="/belege/:id" element={<BelegView />} />
                            <Route path="/belege/:id/edit" element={<BelegCreate />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="/journal" element={<Navigate to={`/${tenant}/reports`} replace />} />
                            <Route path="/bookings" element={<JournalList />} />
                            <Route path="/bookings/create" element={<BookingCreate />} />
                            <Route path="/bank-accounts" element={<BankAccountsList />} />
                            <Route path="/users" element={<UsersList />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/" element={<Navigate to={`/${tenant}/dashboard`} replace />} />
                        </Routes>
                    </MainLayout>
                </OnboardingCheck>
            } />
        </Routes>
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
