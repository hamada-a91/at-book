import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingUp, Shield, Zap, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
                <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/atbook-logo.png" alt="AT-Book Logo" className="h-12 w-auto rounded-lg" />
                    </div>
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                            onClick={() => navigate('/login')}
                        >
                            Log in
                        </Button>
                        <Button
                            className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-indigo-500/30 rounded-full px-6"
                            onClick={() => navigate('/register')}
                        >
                            Get Started
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32">
                {/* Decorative elements */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-300 dark:bg-indigo-600 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-xl opacity-20 dark:opacity-10 animate-blob"></div>
                <div className="absolute top-40 right-10 w-72 h-72 bg-cyan-300 dark:bg-cyan-600 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-xl opacity-20 dark:opacity-10 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-purple-300 dark:bg-purple-600 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-xl opacity-20 dark:opacity-10 animate-blob animation-delay-4000"></div>

                <div className="container mx-auto px-4 text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 text-sm text-indigo-700 dark:text-indigo-300 mb-8 font-medium">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        GoBD Compliant Accounting
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold mb-8 tracking-tight text-gray-900 dark:text-white">
                        Accounting made simple<br />
                        <span className="bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                            for German Business
                        </span>
                    </h1>

                    <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed">
                        The modern, secure, and GoBD-compliant accounting solution.
                        Streamline your finances with confidence.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button
                            size="lg"
                            className="text-lg px-8 h-14 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-lg shadow-indigo-500/30 rounded-full"
                            onClick={() => navigate('/register')}
                        >
                            Start Free Trial
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="text-lg px-8 h-14 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white rounded-full"
                            onClick={() => navigate('/login')}
                        >
                            Live Demo
                        </Button>
                    </div>
                </div>
            </div>

            {/* Features Grid */}
            <div className="container mx-auto px-4 py-24">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        {
                            icon: Shield,
                            title: "GoBD Secure",
                            desc: "Full compliance with German regulations including audit trails.",
                            gradient: "from-blue-500 to-blue-600",
                            bg: "bg-blue-50 dark:bg-blue-900/20",
                            iconColor: "text-blue-600 dark:text-blue-400"
                        },
                        {
                            icon: FileText,
                            title: "Smart Booking",
                            desc: "Automated booking workflows with SKR03/SKR04 support.",
                            gradient: "from-purple-500 to-purple-600",
                            bg: "bg-purple-50 dark:bg-purple-900/20",
                            iconColor: "text-purple-600 dark:text-purple-400"
                        },
                        {
                            icon: TrendingUp,
                            title: "Real-time Analytics",
                            desc: "Instant insights into your financial health and performance.",
                            gradient: "from-green-500 to-green-600",
                            bg: "bg-green-50 dark:bg-green-900/20",
                            iconColor: "text-green-600 dark:text-green-400"
                        },
                        {
                            icon: Zap,
                            title: "Lightning Fast",
                            desc: "Built on modern tech for instant load times and reliability.",
                            gradient: "from-orange-500 to-orange-600",
                            bg: "bg-orange-50 dark:bg-orange-900/20",
                            iconColor: "text-orange-600 dark:text-orange-400"
                        }
                    ].map((feature, index) => (
                        <Card
                            key={index}
                            className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all hover:-translate-y-1 duration-300 group"
                        >
                            <CardHeader>
                                <div className={`h-12 w-12 rounded-xl ${feature.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                    <feature.icon className={`h-6 w-6 ${feature.iconColor}`} />
                                </div>
                                <CardTitle className="text-gray-900 dark:text-white">{feature.title}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-gray-600 dark:text-gray-300">
                                    {feature.desc}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Trust Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 py-20">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold mb-12 text-gray-900 dark:text-white">
                        Trusted by German Businesses
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                        {[
                            "100% Data Security",
                            "German Servers",
                            "Daily Backups"
                        ].map((item, i) => (
                            <div key={i} className="flex items-center justify-center gap-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                <span className="font-medium">{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 py-12">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Entwicklung & Kontakt</h3>
                            <div className="text-gray-600 dark:text-gray-400 space-y-2 text-sm">
                                <p>Vorpoint</p>
                                <p className="font-medium">Developer: Ahmed Tahhan</p>
                                <p>Gorkistraße 84</p>
                                <p>04347 Leipzig</p>
                                <p className="pt-2"> <a href="mailto:info@vorpoint.de" className="hover:text-indigo-600 dark:hover:text-indigo-400">info@vorpoint.de</a></p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Rechtliches</h3>
                            <div className="text-gray-600 dark:text-gray-400 space-y-2 text-sm">
                                <p>Angaben gemäß § 5 TMG</p>
                                <p>
                                    Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV: Ahmed Tahhan
                                </p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Support</h3>
                            <div className="text-gray-600 dark:text-gray-400 space-y-2 text-sm">
                                <p>Telefon: +491778663796</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4">Links</h3>
                            <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Privacy</a>
                                <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms</a>
                                <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Contact</a>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-8 text-center text-gray-600 dark:text-gray-400 text-sm">
                        <p>© 2025 AT-Book. Made by Ahmed Tahhan.</p>
                    </div>
                </div>
            </footer>

            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
            `}</style>
        </div>
    );
}
