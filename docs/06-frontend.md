# 06 – Frontend (React SPA)

## Stack & Einstieg

- **React 18 + TypeScript**, gebaut mit **Vite 7** (`vite.config.js`, `laravel-vite-plugin`).
- Einstiegspunkt: `resources/js/app.tsx` – enthält Router, QueryClient, ThemeProvider **und** einen globalen fetch-Interceptor.
- Styling: **Tailwind CSS 4** + shadcn/ui-Komponenten (`resources/js/components/ui/`, konfiguriert über `components.json`).
- Dark/Light-Mode: `theme-provider.tsx` + `theme-toggle.tsx`.

## Routing & Tenant-Slug

React Router 7 mit dem Muster **`/{tenant-slug}/{resource}`**:

```
/welcome, /login, /register        → öffentlich
/{tenant}/onboarding               → Onboarding-Wizard (OnboardingGuard)
/{tenant}/dashboard                → Dashboard
/{tenant}/bookings, /invoices, /belege, /quotes, /orders,
/{tenant}/contacts, /products, /reports, /settings, /users, …
/admin                             → Plattform-Admin-Dashboard
```

Der Slug ist **nur Navigation** – die Sicherheit liegt beim Backend (JWT → Tenant). Alle internen Links müssen den Slug mitführen (`navigate('/' + tenant + '/invoices')`).

## Auth-Handling (Ist-Zustand)

- JWT wird nach Login in **`localStorage`** unter `auth_token` gespeichert.
- In `app.tsx` wird **`window.fetch` global überschrieben**: Bei allen `/api`-Aufrufen wird der Token automatisch als `Authorization: Bearer` angehängt (außer `/login`, `/register`). Parallel existiert eine **axios-Instanz** (`lib/axios.ts`) mit demselben Zweck.
- ⚠️ Diese Doppelstruktur (fetch-Override + axios) und localStorage-Token sind bekannte Schwachpunkte – siehe [08-kritische-punkte.md](08-kritische-punkte.md). **Für neuen Code: die axios-Instanz aus `lib/axios.ts` verwenden**, keine rohen `fetch`-Aufrufe.

## Verzeichnisstruktur

```
resources/js/
├── app.tsx              # Router, Provider, fetch-Interceptor
├── pages/               # 1 Datei pro Screen
│   ├── Dashboard.tsx, JournalList.tsx, BookingCreate.tsx
│   ├── InvoicesList/Create/Preview.tsx
│   ├── BelegeList/Create/View.tsx
│   ├── QuotesList/Create/Preview.tsx, OrdersList.tsx, OrderDetail.tsx
│   ├── AccountsList/Create/Detail.tsx, ContactsList.tsx
│   ├── Products/ (ProductList, ProductCreate, InventoryMovements)
│   ├── Reports.tsx, InventoryReport.tsx, Settings.tsx
│   ├── Users/, BugReports/, Admin/ (AdminDashboard)
│   ├── Auth/ (Login, Register), Onboarding.tsx, Welcome.tsx, Profile.tsx
│   └── Onboarding.tsx.broken   # ⚠️ tote Datei, kann weg
├── components/
│   ├── ui/              # shadcn/ui-Basiskomponenten (Button, Dialog, Select, …)
│   ├── layout/          # MainLayout (Sidebar/Topbar)
│   ├── dashboard/, reports/
│   ├── BookingMask.tsx          # Buchungserfassung (Soll/Haben)
│   ├── AccountSelector.tsx, ContactSelector.tsx, ProductSelector.tsx
│   ├── AccountPlanManagement.tsx, BackupManagement.tsx
│   ├── OnboardingGuard.tsx      # Leitet zu /onboarding um, wenn nicht abgeschlossen
│   └── SendEmailModal.tsx, ContactForm.tsx, BankAccountForm.tsx, …
├── lib/
│   ├── axios.ts         # Vorkonfigurierte axios-Instanz (Token, BaseURL)
│   ├── api.ts           # API-Hilfsfunktionen
│   ├── currency.ts      # Cents ↔ EUR Formatierung  ← IMMER hierüber formatieren
│   └── utils.ts         # cn() u.a.
├── services/            # Service-Layer (bugReportService, userService) – Ausbau erwünscht
└── types/               # TypeScript-Typen
```

## Datenfluss-Konventionen

1. **Server-State über React Query** (`@tanstack/react-query`): Queries für Listen/Detail, Mutations für Schreiboperationen mit Invalidierung.
2. **Formulare mit react-hook-form + zod**-Schemas.
3. **Beträge**: API liefert Cents → Anzeige über `lib/currency.ts`; Eingaben vor dem Senden in Cents wandeln.
4. **Neue API-Aufrufe** möglichst in `services/` kapseln statt inline in Komponenten (der bestehende Code ist hier inkonsistent – bei Gelegenheit refactoren).

## Build

```bash
sail npm run dev     # Vite-Dev-Server (Port 5173, HMR)
sail npm run build   # Produktions-Build nach public/build
```
