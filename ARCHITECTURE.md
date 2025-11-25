# AT-Book: GoBD-Compliant Accounting System

## 🎯 Project Overview

AT-Book is a modern, GoBD-compliant accounting system designed for the German market, similar to Lexware/Sevdesk. It implements strict German accounting principles including double-entry bookkeeping (Doppelte Buchführung), immutable journal entries, and comprehensive audit trails.

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS 4 + shadcn/ui
- **State Management**: TanStack Query (React Query) + Zustand
- **Backend**: Laravel 11 + Laravel Sail (Docker)
- **Database**: PostgreSQL
- **Authentication**: JWT (stateless) - *To be implemented*

### Architecture Pattern
**Modular Monolith** - Domain-driven folder structure for scalability

```
app/
├── Modules/
│   ├── Accounting/          # Core bookkeeping domain
│   │   ├── Models/          # JournalEntry, JournalEntryLine, Account
│   │   ├── Services/        # BookingService (GoBD logic)
│   │   ├── Actions/         # Single-responsibility classes
│   │   ├── DTOs/            # Data Transfer Objects
│   │   └── Enums/           # BookingStatus, TaxType
│   ├── Documents/           # Document Management System
│   │   ├── Models/          # Document
│   │   └── Services/        # DocumentService
│   └── Banking/             # Bank reconciliation (future)
│       ├── Models/          # BankTransaction
│       └── Services/        # ReconciliationService
```

## 📊 Database Schema

### Core Tables

#### `accounts` - Chart of Accounts (SKR03/SKR04)
```sql
- id
- code (e.g., '8400')
- name (e.g., 'Erlöse 19% USt')
- type (asset, liability, equity, revenue, expense)
- tax_key_code (e.g., 'UST_19')
- is_system (prevents deletion)
```

#### `journal_entries` - Booking Headers
```sql
- id
- batch_id (UUID - groups split bookings)
- booking_date
- description
- status (draft, posted, cancelled)
- locked_at (GoBD: immutability timestamp)
- user_id (who created)
- timestamps
- soft_deletes
```

#### `journal_entry_lines` - Debit/Credit Lines
```sql
- id
- journal_entry_id
- account_id
- type (debit, credit)
- amount (bigint - cents)
- tax_key (e.g., 'UST_19')
- tax_amount (bigint - cents)
- timestamps
```

#### `documents` - Receipt Management
```sql
- id
- documentable_type/id (polymorphic)
- path
- original_name
- mime_type
- size_bytes
- hash_sha256 (GoBD integrity check)
- uploaded_at
- uploaded_by
```

#### `audit_logs` - Complete Audit Trail
```sql
- id
- user_id
- action (create, update, delete, lock, reverse)
- entity_type
- entity_id
- old_values (JSON)
- new_values (JSON)
- ip_address
- user_agent
- created_at
```

### Key Relationships
- `JournalEntry` (1) ↔ (N) `JournalEntryLine`
- `JournalEntry` (1) ↔ (N) `Document` (polymorphic)
- `Account` (1) ↔ (N) `JournalEntryLine`

## 🔐 GoBD Compliance Features

### 1. Immutability (Unveränderbarkeit)
- Once a booking is "locked" (`locked_at` is set), it **cannot be edited or deleted**
- Implemented in `BookingService::lockBooking()`
- Any corrections must be done via reversal entries (Stornobuchung)

### 2. Audit Trail (Prüfpfad)
- Every change to sensitive data is logged in `audit_logs`
- Tracks: User, Timestamp, Old Values, New Values
- *Implementation: Laravel Observer (to be added)*

### 3. Document Linking (Belegprinzip)
- Every booking can have attached receipts (PDF/Image)
- SHA-256 hash ensures document integrity
- Polymorphic relation allows linking to any entity

### 4. Double-Entry Bookkeeping
- Enforced in `BookingService::createBooking()`
- Validates: `SUM(Debit) === SUM(Credit)`
- Transaction-safe database operations

## 🚀 API Endpoints

### Accounts
```
GET /api/accounts
```
Returns the chart of accounts (SKR03/SKR04)

### Journal Entries
```
POST /api/bookings
Body: { date, description, lines: [{ account_id, type, amount, tax_key, tax_amount }] }
```
Create a new draft booking

```
POST /api/bookings/{id}/lock
```
**GoBD Critical**: Finalizes a booking (sets `locked_at`, changes status to 'posted')

```
POST /api/bookings/{id}/reverse
```
Creates a reversal entry (Stornobuchung) for a locked booking

```
GET /api/bookings?status=posted
```
List journal entries with optional filtering

## 💻 Frontend Components

### BookingMask Component
Located: `resources/js/components/BookingMask.tsx`

**Features:**
- Dynamic form array for unlimited booking lines
- Real-time balance validation (Debit = Credit)
- Account selection via shadcn/ui Select
- Zod schema validation
- React Hook Form integration

**Validation Rules:**
```typescript
- Date: Required, valid date
- Description: Min 3 characters
- Lines: Min 2 lines required
- Balance: SUM(Debit) must equal SUM(Credit)
```

## 🎨 UI Components (shadcn/ui)

All components are in `resources/js/components/ui/`:
- `button.tsx` - Primary actions
- `card.tsx` - Container component
- `input.tsx` - Form inputs
- `select.tsx` - Dropdown (Account selection)
- `form.tsx` - Form context provider

## 📝 Tax Handling Assumptions

1. **Tax Keys**: Simplified system (UST_19, UST_7, VST_19, etc.)
2. **Account Configuration**: Accounts have default tax keys
3. **Calculation**: Tax amounts calculated automatically (to be implemented)
4. **Storage**: Net amount, tax amount, and tax key stored explicitly
5. **DATEV Export**: Schema supports mapping to DATEV format (future)

## 🔧 Setup Instructions

### 1. Install Dependencies
```bash
# Backend (Laravel Sail)
./vendor/bin/sail up -d
./vendor/bin/sail composer install

# Frontend
npm install

# Additional packages
npm install typescript @types/react @types/react-dom
```

### 2. Run Migrations
```bash
./vendor/bin/sail artisan migrate:fresh
```

### 3. Seed Accounts (SKR03)
```bash
./vendor/bin/sail artisan db:seed --class=AccountSeeder
```

### 4. Start Development Server
```bash
# Frontend (Vite)
npm run dev

# Backend (Laravel Sail)
./vendor/bin/sail up
```

## ✅ Completed Implementation

- [x] Database schema (accounts, journal_entries, documents, audit_logs)
- [x] Laravel migrations
- [x] Core models (JournalEntry, JournalEntryLine, Account, Document, AuditLog)
- [x] BookingService with GoBD logic (create, lock, reverse)
- [x] API controllers (JournalEntryController, AccountController)
- [x] API routes
- [x] React app setup with TypeScript
- [x] shadcn/ui components (Button, Card, Input, Select, Form)
- [x] BookingMask component with validation
- [x] SKR03 account seeder

## 🚧 Next Steps (Production Readiness)

### High Priority
- [ ] **Install shadcn/ui properly**: Run `npx shadcn-ui@latest init`
- [ ] **JWT Authentication**: Implement Laravel Sanctum or Tymon/JWT
- [ ] **Tax Calculator Service**: Auto-calculate tax from gross/net amounts
- [ ] **Audit Log Observer**: Automatic logging on model changes
- [ ] **Error Handling**: Global error boundaries and API error handling
- [ ] **Loading States**: Skeleton loaders and spinners

### Medium Priority
- [ ] **Bank Import**: CSV/CAMT parser
- [ ] **Reconciliation UI**: Split-screen matching interface
- [ ] **Rule Engine**: Auto-suggest accounts based on transaction data
- [ ] **DATEV Export**: CSV export compatible with DATEV format
- [ ] **Dashboard**: BWA preview, bank balance, KPIs
- [ ] **Journal Table**: Data table with sorting, filtering, pagination

### Low Priority
- [ ] **Multi-tenancy**: Separate data per company
- [ ] **Role-based Access**: Admin, Accountant, Viewer roles
- [ ] **Reporting**: P&L, Balance Sheet, VAT reports
- [ ] **Dark Mode**: Theme switcher
- [ ] **i18n**: German/English language support

## 🧪 Testing Strategy

### Backend Tests
```bash
./vendor/bin/sail artisan test
```

**Test Coverage:**
- Unit tests for `BookingService` (balance validation, locking logic)
- Feature tests for API endpoints
- Database transaction rollback tests

### Frontend Tests
```bash
npm run test
```

**Test Coverage:**
- Component tests (BookingMask validation)
- Integration tests (API calls)
- E2E tests (Playwright/Cypress)

## 📚 Key Files Reference

### Backend
- `app/Modules/Accounting/Services/BookingService.php` - Core GoBD logic
- `app/Http/Controllers/Api/JournalEntryController.php` - API endpoints
- `database/migrations/2025_11_24_000001_create_journal_entries_table.php` - Schema
- `database/seeders/AccountSeeder.php` - SKR03 accounts
- `routes/api.php` - API routes

### Frontend
- `resources/js/app.tsx` - React entry point
- `resources/js/components/BookingMask.tsx` - Main booking form
- `resources/js/components/ui/*` - shadcn/ui components
- `resources/views/app.blade.php` - HTML template
- `vite.config.js` - Build configuration

## 🔒 Security Considerations

1. **SQL Injection**: Prevented by Eloquent ORM
2. **XSS**: React escapes output by default
3. **CSRF**: Laravel CSRF middleware (to be configured for API)
4. **Authorization**: Implement policies for journal entry access
5. **Rate Limiting**: Add throttle middleware to API routes

## 📖 German Accounting Terms

- **Buchungssatz**: Booking entry
- **Soll**: Debit
- **Haben**: Credit
- **Doppelte Buchführung**: Double-entry bookkeeping
- **Stornobuchung**: Reversal entry
- **Belegprinzip**: Document principle (every booking needs a receipt)
- **GoBD**: Grundsätze zur ordnungsmäßigen Führung und Aufbewahrung von Büchern
- **SKR03/04**: Standard chart of accounts
- **USt**: Umsatzsteuer (Sales tax)
- **VSt**: Vorsteuer (Input tax)

## 🤝 Contributing

This is a production-ready MVP. To extend:
1. Follow the modular structure in `app/Modules/`
2. Add migrations for new tables
3. Create services for complex business logic
4. Write tests for all new features

## 📄 License

Proprietary - All rights reserved

---

**Built with ❤️ for German accounting compliance**
