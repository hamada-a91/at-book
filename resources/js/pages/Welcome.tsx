import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    FileText, 
    TrendingUp, 
    Shield, 
    Zap, 
    CheckCircle2, 
    ArrowRight, 
    Sparkles, 
    RefreshCw, 
    Receipt, 
    Database, 
    Users, 
    Lock,
    Eye,
    FolderKanban,
    Building2,
    Menu,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Welcome() {
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img src="/atbook-logo.png" alt="AT-Book Logo" className="h-10 w-auto rounded-lg shadow-sm" />
                        <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                            AT-Book
                        </span>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-400">
                        <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Funktionen</a>
                        <a href="#workflow" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Ablauf</a>
                        <a href="#security" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Sicherheit</a>
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <Button
                            variant="ghost"
                            className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            onClick={() => navigate('/login')}
                        >
                            Anmelden
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-medium shadow-md shadow-indigo-500/10 hover:shadow-lg transition-all rounded-lg px-5"
                            onClick={() => navigate('/register')}
                        >
                            Kostenlos starten
                        </Button>
                    </div>

                    {/* Hamburger Button */}
                    <button 
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                        className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none"
                    >
                        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>

                {/* Mobile Menu Drawer */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-slate-200/60 dark:border-slate-800/60 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl px-4 pt-2 pb-6 space-y-4">
                        <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-base font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400">Funktionen</a>
                        <a href="#workflow" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-base font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400">Ablauf</a>
                        <a href="#security" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-base font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400">Sicherheit</a>
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                            <Button
                                variant="outline"
                                className="w-full h-11 text-base font-semibold border-slate-200 dark:border-slate-800"
                                onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                            >
                                Anmelden
                            </Button>
                            <Button
                                className="w-full h-11 text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={() => { setMobileMenuOpen(false); navigate('/register'); }}
                            >
                                Kostenlos starten
                            </Button>
                        </div>
                    </div>
                )}
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
                {/* Decorative background grid and meshes */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a08_1px,transparent_1px),linear-gradient(to_bottom,#0f172a08_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
                
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full filter blur-3xl"></div>
                <div className="absolute top-60 -left-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full filter blur-3xl"></div>

                {/* Hero Background Image */}
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
                    <img 
                        src="/images/hero-background.png" 
                        alt="" 
                        className="w-full h-full object-cover object-center select-none"
                    />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-8 tracking-wide uppercase">
                        <Shield className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        GoBD-konforme deutsche Buchhaltung
                    </div>

                    <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl mx-auto leading-[1.1] mb-8">
                        Buchhaltung & Warenwirtschaft
                        <span className="block mt-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">
                            einfach, rechtssicher & modern.
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Die GoBD-konforme All-in-One Software für kleine Unternehmen und Selbstständige. Angebote, Rechnungen, OCR-Belegerfassung, Bankabgleich und Berichte – nahtlos an einem Ort.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto text-base px-8 h-12 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all rounded-lg"
                            onClick={() => navigate('/register')}
                        >
                            Kostenlos registrieren
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="w-full sm:w-auto text-base px-8 h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-lg"
                            onClick={() => navigate('/login')}
                        >
                            Demo-Zugang nutzen
                        </Button>
                    </div>

                    {/* Trust badging */}
                    <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 text-xs font-semibold text-slate-500 dark:text-slate-500 border-y border-slate-200/60 dark:border-slate-800/60 py-5 max-w-3xl mx-auto">
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> GoBD-KONFORM</span>
                        <span className="text-slate-300 dark:text-slate-800">•</span>
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> DEUTSCHER KONTENRAHMEN SKR03</span>
                        <span className="text-slate-300 dark:text-slate-800">•</span>
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> MULTI-MANDANTENFÄHIG</span>
                        <span className="text-slate-300 dark:text-slate-800">•</span>
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> BACKUP-SCHUTZ</span>
                    </div>
                </div>
            </section>

            {/* App Mockup Preview Section */}
            <section className="pb-24 px-4 sm:px-6 lg:px-8 relative max-w-7xl mx-auto">
                <div className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 shadow-2xl shadow-slate-200/50 dark:shadow-none hover:scale-[1.005] hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-500 group">
                    {/* Top window buttons */}
                    <div className="flex items-center gap-2 pb-4 border-b border-slate-200/60 dark:border-slate-800/80 mb-4">
                        <span className="w-3 h-3 rounded-full bg-rose-400"></span>
                        <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                        <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-mono ml-2">app.at-book.de/demo/dashboard</span>
                    </div>

                    {/* Generated Hero Dashboard Image */}
                    <div className="relative overflow-hidden rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-950">
                        <img 
                            src="/images/hero-dashboard.png" 
                            alt="AT-Book Finanz-Cockpit & GoBD-Buchhaltung" 
                            className="w-full h-auto object-cover select-none pointer-events-none rounded-xl"
                        />
                    </div>
                </div>
            </section>

            {/* Feature Grid Section */}
            <section id="features" className="py-24 bg-white dark:bg-slate-900 border-y border-slate-200/60 dark:border-slate-800/60 relative z-10 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
                            Alles, was Ihre Buchhaltung braucht.
                        </h2>
                        <p className="text-lg text-slate-600 dark:text-slate-400">
                            Wir verbinden doppelte Buchführung nach deutschem Recht mit den automatisierten Abläufen einer modernen Warenwirtschaft.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            {
                                icon: Shield,
                                title: "GoBD & Finanzen",
                                desc: "Rechtssichere doppelte Buchführung, GoBD-konforme Festschreibung und Kontenplan SKR03 für deutsche Unternehmen.",
                                color: "text-indigo-600 dark:text-indigo-400",
                                bg: "bg-indigo-50 dark:bg-indigo-950/30",
                                border: "group-hover:border-indigo-500/30"
                            },
                            {
                                icon: FileText,
                                title: "Rechnungen & Angebote",
                                desc: "Erstellen Sie Angebote und wandeln Sie diese direkt in Aufträge, Lieferscheine und rechtssichere Ausgangsrechnungen um.",
                                color: "text-violet-600 dark:text-violet-400",
                                bg: "bg-violet-50 dark:bg-violet-950/30",
                                border: "group-hover:border-violet-500/30"
                            },
                            {
                                icon: Receipt,
                                title: "OCR Beleg-Scan",
                                desc: "Laden Sie Belege einfach hoch. Unser integrierter OCR-Scan liest Beträge, Steuersätze und Kontakt-Metadaten automatisch aus.",
                                color: "text-cyan-600 dark:text-cyan-400",
                                bg: "bg-cyan-50 dark:bg-cyan-950/30",
                                border: "group-hover:border-cyan-500/30"
                            },
                            {
                                icon: RefreshCw,
                                title: "Automatisches Banking",
                                desc: "Kontoauszug-Import im Handumdrehen. Intelligente Buchungsvorschläge balances offene Umsätze automatisch mit Belegen ab.",
                                color: "text-emerald-600 dark:text-emerald-400",
                                bg: "bg-emerald-50 dark:bg-emerald-950/30",
                                border: "group-hover:border-emerald-500/30"
                            },
                            {
                                icon: TrendingUp,
                                title: "Berichte & Auswertungen",
                                desc: "Echtzeit-Einblicke in Summen- und Saldenlisten (SuSa), Gewinn- und Verlustrechnung (GuV), BWA und Ihre Unternehmensbilanz.",
                                color: "text-pink-600 dark:text-pink-400",
                                bg: "bg-pink-50 dark:bg-pink-950/30",
                                border: "group-hover:border-pink-500/30"
                            },
                            {
                                icon: Sparkles,
                                title: "USt-VA & EÜR",
                                desc: "Praktische Eingabehilfen für die Umsatzsteuer-Voranmeldung und Einnahmen-Überschuss-Rechnung zur manuellen ELSTER-Abgabe.",
                                color: "text-amber-600 dark:text-amber-400",
                                bg: "bg-amber-50 dark:bg-amber-950/30",
                                border: "group-hover:border-amber-500/30"
                            },
                            {
                                icon: Users,
                                title: "Multi-Mandantenfähig",
                                desc: "Verwalten Sie mühelos mehrere Firmenkontakte oder Mandanten. Weisen Sie Mitarbeitern dedizierte Rollen und Rechte zu.",
                                color: "text-teal-600 dark:text-teal-400",
                                bg: "bg-teal-50 dark:bg-teal-950/30",
                                border: "group-hover:border-teal-500/30"
                            },
                            {
                                icon: Database,
                                title: "Backup & Restore",
                                desc: "Erstellen Sie vollständige Backups Ihres Mandanten als Archiv und stellen Sie diese mit einem Klick sicher wieder her.",
                                color: "text-rose-600 dark:text-rose-400",
                                bg: "bg-rose-50 dark:bg-rose-950/30",
                                border: "group-hover:border-rose-500/30"
                            }
                        ].map((feat, i) => (
                            <Card 
                                key={i} 
                                className={`border border-slate-200/60 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-950 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group`}
                            >
                                <CardHeader className="pb-3">
                                    <div className={`w-11 h-11 rounded-lg ${feat.bg} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform duration-300`}>
                                        <feat.icon className={`w-5 h-5 ${feat.color}`} />
                                    </div>
                                    <CardTitle className="text-base text-slate-900 dark:text-white">{feat.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <CardDescription className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                        {feat.desc}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Workflow section */}
            <section id="workflow" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-4">
                        So einfach verwalten Sie Ihre Finanzen
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-lg">
                        In drei Schritten zu einer rechtssicheren Buchhaltung. Ohne langes Einarbeiten.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            step: "01",
                            title: "Firma registrieren",
                            desc: "Legen Sie in Sekunden Ihr Mandantenkonto an. Geben Sie Ihren Namen und Firmennamen ein und wählen Sie Ihren Kontenplan aus."
                        },
                        {
                            step: "02",
                            title: "Bank importieren & OCR nutzen",
                            desc: "Importieren Sie Ihre Kontoauszüge und laden Sie Belege hoch. Der intelligente OCR-Scanner nimmt Ihnen das mühsame Tippen ab."
                        },
                        {
                            step: "03",
                            title: "Rechtssicher buchen",
                            desc: "Dank doppelter Buchführung und GoBD-konformer Dokumentation sind Ihre Zahlen jederzeit finanzamtskonform erfasst."
                        }
                    ].map((step, idx) => (
                        <div key={idx} className="relative p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:shadow-lg transition-shadow">
                            <span className="absolute -top-6 left-6 font-mono text-5xl font-extrabold bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent opacity-85">{step.step}</span>
                            <div className="pt-4">
                                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{step.title}</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Security banner */}
            <section id="security" className="py-20 bg-slate-900 dark:bg-slate-950 text-white border-t border-slate-800">
                <div className="max-w-5xl mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
                        <Lock className="w-8 h-8 text-indigo-400" />
                        Sicherheit & Datenschutz an oberster Stelle
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto mb-10">
                        Ihre Unternehmensdaten sind bei uns durch modernste Sicherheitsstandards geschützt. Verschlüsselte Übertragung, regelmäßige mandantenbezogene Backups und vollkommene Transparenz.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-800">
                            <h3 className="font-bold text-lg text-white mb-2">100% DSGVO-konform</h3>
                            <p className="text-slate-400 text-xs">Vollständiger Schutz personenbezogener Daten nach europäischen Richtlinien.</p>
                        </div>
                        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-800">
                            <h3 className="font-bold text-lg text-white mb-2">Sichere Backups</h3>
                            <p className="text-slate-400 text-xs">Einfache Backup-Erstellung zum Download und Wiederherstellung per Mausklick.</p>
                        </div>
                        <div className="bg-slate-800/50 p-5 rounded-xl border border-slate-800">
                            <h3 className="font-bold text-lg text-white mb-2">Revisionssicher</h3>
                            <p className="text-slate-400 text-xs">Änderungshistorien und unveränderbare Festschreibung Ihrer GoBD-Geschäftsvorfälle.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom CTA section */}
            <section className="py-24 bg-gradient-to-b from-slate-50 to-indigo-50/50 dark:from-slate-900 dark:to-slate-950 border-t border-slate-200/60 dark:border-slate-800/60">
                <div className="max-w-4xl mx-auto text-center px-4">
                    <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
                        Bereit für eine einfachere Buchhaltung?
                    </h2>
                    <p className="text-slate-600 dark:text-slate-400 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                        Starten Sie jetzt Ihren kostenlosen 3-monatigen Testzeitraum. Sie müssen keine Kreditkarte hinterlegen und können direkt loslegen.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto text-base px-8 h-12 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
                            onClick={() => navigate('/register')}
                        >
                            Jetzt kostenlos testen
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="w-full sm:w-auto text-base px-8 h-12 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            onClick={() => navigate('/login')}
                        >
                            Zum Demo-Login
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-12 transition-colors duration-300 text-slate-600 dark:text-slate-400">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <img src="/atbook-logo.png" alt="AT-Book Logo" className="h-8 w-auto rounded" />
                                <span className="font-bold text-slate-900 dark:text-white">AT-Book</span>
                            </div>
                            <p className="text-xs leading-relaxed max-w-xs">
                                Mandantenfähige Software für Buchhaltung & Warenwirtschaft in kleinen Unternehmen. GoBD-konform, flexibel und sicher.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-950 dark:text-white mb-4 text-sm">Entwicklung & Kontakt</h3>
                            <div className="space-y-2 text-xs">
                                <p>Vorpoint</p>
                                <p className="font-medium">Entwickler: Ahmed Tahhan</p>
                                <p>Gorkistraße 84</p>
                                <p>04347 Leipzig</p>
                                <p className="pt-1">
                                    <a href="mailto:info@vorpoint.de" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">info@vorpoint.de</a>
                                </p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-950 dark:text-white mb-4 text-sm">Rechtliches</h3>
                            <div className="space-y-2 text-xs">
                                <p>Angaben gemäß § 5 TMG</p>
                                <p>Inhaltlich verantwortlich nach § 55 Abs. 2 RStV: Ahmed Tahhan</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-950 dark:text-white mb-4 text-sm">Links & Support</h3>
                            <div className="flex flex-col gap-2 text-xs">
                                <p>Telefon: +491778663796</p>
                                <div className="flex gap-4 pt-2">
                                    <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">Datenschutz (Platzhalter)</a>
                                    <a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium">Impressum (Platzhalter)</a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-8 text-center text-xs text-slate-500">
                        <p>© 2026 AT-Book. Alle Rechte vorbehalten. Entwickelt von Ahmed Tahhan.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
