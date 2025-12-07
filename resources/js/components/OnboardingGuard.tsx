import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

interface OnboardingGuardProps {
    children: React.ReactNode;
}

interface OnboardingStatus {
    completed: boolean;
    steps: {
        company_data: boolean;
        tax_settings: boolean;
        business_model: boolean;
        legal_form: boolean;
        account_plan: boolean;
    };
}

export default function OnboardingGuard({ children }: OnboardingGuardProps) {
    const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);
    const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        checkOnboardingStatus();
    }, [location.pathname]);

    const checkOnboardingStatus = async () => {
        // Erlaube Zugriff auf Onboarding-Route und Settings
        if (location.pathname === '/onboarding' || location.pathname === '/settings') {
            setIsOnboardingComplete(true);
            return;
        }

        try {
            const { data } = await axios.get('/api/onboarding/status');

            console.log('📊 Onboarding Status:', data);
            setOnboardingStatus(data);

            if (!data.completed) {
                console.warn('⚠️ Onboarding nicht abgeschlossen, weiterleiten zu /onboarding...');
                // Sofortige Weiterleitung mit replace
                navigate('/onboarding', { replace: true });
                return;
            }

            setIsOnboardingComplete(true);
        } catch (error) {
            console.error('❌ Error checking onboarding status:', error);
            // Bei Fehler auch zur Sicherheit zu Onboarding
            navigate('/onboarding', { replace: true });
        }
    };

    if (isOnboardingComplete === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-900 dark:via-purple-950 dark:to-slate-900">
                <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600"></div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
