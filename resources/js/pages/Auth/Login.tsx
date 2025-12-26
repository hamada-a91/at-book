import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '@/lib/axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowLeft, Mail, Lock } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        remember: false,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data } = await axios.post('/api/login', formData);

            if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }

            if (data.redirect) {
                window.location.href = data.redirect;
            } else {
                navigate(`/${data.tenant.slug}/dashboard`);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'An error occurred during login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 p-4">
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

            <div className="w-full max-w-md">
                <Card className="border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
                    <CardHeader className="space-y-3 pb-8 text-center border-b border-gray-200 dark:border-gray-700">
                        <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-indigo-500/30">
                            AT
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
                                Welcome Back
                            </CardTitle>
                            <CardDescription className="text-gray-600 dark:text-gray-400">
                                Sign in to access your dashboard
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="pt-8">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <Alert variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

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
                                        className="pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 h-11"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-gray-900 dark:text-gray-100">Password</Label>
                                    <a href="#" className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline">
                                        Forgot password?
                                    </a>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        required
                                        placeholder="••••••••"
                                        disabled={loading}
                                        className="pl-10 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-indigo-500 focus:ring-indigo-500 h-11"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="remember"
                                    checked={formData.remember}
                                    onCheckedChange={(checked) =>
                                        setFormData({ ...formData, remember: checked as boolean })
                                    }
                                    disabled={loading}
                                    className="border-gray-300 dark:border-gray-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:text-white"
                                />
                                <label
                                    htmlFor="remember"
                                    className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                                >
                                    Remember me on this device
                                </label>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-11 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-indigo-500/30 font-medium text-base rounded-lg mt-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="justify-center border-t border-gray-200 dark:border-gray-700 pt-6 pb-6">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Don't have an account?{' '}
                            <a href="/register" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium">
                                Create an account
                            </a>
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
