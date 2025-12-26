import { useState } from 'react';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, Building2, User, Mail, Lock, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState<Record<string, string[]>>({});
    const [formData, setFormData] = useState({
        company_name: '',
        slug: '',
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
    });

    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    };

    const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const companyName = e.target.value;
        setFormData({
            ...formData,
            company_name: companyName,
            slug: generateSlug(companyName),
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setValidationErrors({});

        try {
            const { data } = await axios.post('/api/register', formData);

            if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }

            const redirectPath = data.redirect || `/${data.tenant.slug}/onboarding`;
            window.location.href = redirectPath;
        } catch (err: any) {
            if (err.response?.status === 422 && err.response?.data?.errors) {
                setValidationErrors(err.response.data.errors);
                setError('Please check your inputs and try again.');
            } else {
                setError(err.response?.data?.message || err.message || 'An error occurred during registration');
            }
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4 py-8">
            <div className="absolute top-8 left-8">
                <Button
                    variant="ghost"
                    className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    onClick={() => navigate('/')}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Button>
            </div>

            <div className="w-full max-w-2xl">
                <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
                    <CardHeader className="space-y-3 pb-8 text-center border-b border-gray-200 dark:border-gray-700">
                        <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-500/30">
                            AT
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                                Create Account
                            </CardTitle>
                            <CardDescription className="text-gray-600 dark:text-gray-400">
                                Start your free 14-day trial. No credit card required.
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="company_name" className="text-gray-900 dark:text-gray-100">Company Name</Label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                        <Input
                                            id="company_name"
                                            value={formData.company_name}
                                            onChange={handleCompanyNameChange}
                                            required
                                            placeholder="Acme Inc."
                                            disabled={loading}
                                            className={`pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 h-11 ${validationErrors.company_name ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    {validationErrors.company_name && (
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.company_name[0]}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="slug" className="text-gray-900 dark:text-gray-100">Company URL</Label>
                                    <div className="relative">
                                        <LinkIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                        <Input
                                            id="slug"
                                            value={formData.slug}
                                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                                            required
                                            placeholder="acme-inc"
                                            disabled={loading}
                                            className={`pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 h-11 ${validationErrors.slug ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    {validationErrors.slug ? (
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.slug[0]}</p>
                                    ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            at-book.com/{formData.slug || 'your-company'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="name" className="text-gray-900 dark:text-gray-100">Your Name</Label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            placeholder="John Doe"
                                            disabled={loading}
                                            className={`pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 h-11 ${validationErrors.name ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    {validationErrors.name && (
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.name[0]}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-gray-900 dark:text-gray-100">Email Address</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                        <Input
                                            id="email"
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            required
                                            placeholder="name@company.com"
                                            disabled={loading}
                                            className={`pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 h-11 ${validationErrors.email ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    {validationErrors.email && (
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.email[0]}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-gray-900 dark:text-gray-100">Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                        <Input
                                            id="password"
                                            type="password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            required
                                            placeholder="Min. 8 characters"
                                            minLength={8}
                                            disabled={loading}
                                            className={`pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 h-11 ${validationErrors.password ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                    {validationErrors.password && (
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{validationErrors.password[0]}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password_confirmation" className="text-gray-900 dark:text-gray-100">Confirm Password</Label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                        <Input
                                            id="password_confirmation"
                                            type="password"
                                            value={formData.password_confirmation}
                                            onChange={(e) => setFormData({ ...formData, password_confirmation: e.target.value })}
                                            required
                                            placeholder="Confirm password"
                                            minLength={8}
                                            disabled={loading}
                                            className={`pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 h-11 ${validationErrors.password_confirmation ? 'border-red-500' : ''}`}
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-indigo-500/30 font-medium text-base rounded-lg mt-4"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    'Get Started Now'
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="justify-center border-t border-gray-200 dark:border-gray-700 pt-6 pb-6">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Already have an account?{' '}
                            <a href="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium">
                                Sign in
                            </a>
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
