# AT-Book Installation Guide

This guide describes how to install and set up the **AT-Book** Multi-Tenant Accounting Application locally.

## Prerequisites

Ensure you have the following installed:
- **PHP**: 8.2 or higher
- **Composer**: Dependency Manager for PHP
- **Node.js**: v18+ and **npm**
- **Database**: PostgreSQL (recommended) or MySQL/MariaDB
- **Web Server**: Apache/Nginx or standard PHP built-in server (for local dev)

---

## Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/your-repo/at-book.git
cd at-book
```

### 2. Install Backend Dependencies
```bash
composer install
```

### 3. Install Frontend Dependencies
```bash
npm install
```

### 4. Environment Configuration
Copy the example environment file and configure it:
```bash
cp .env.example .env
```

Open `.env` and update your database credentials:
```ini
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=at_book
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password
```

### 5. Application Keys
Generate the app key and JWT secret:
```bash
php artisan key:generate
php artisan jwt:secret
```

### 6. Storage Link
Link the public storage directory to verify file downloads work correctly:
```bash
php artisan storage:link
```

### 7. Database Migration
Run the database migrations to create the schema:
```bash
php artisan migrate
```
> **Note:** Seeding is not required. You will create your first user and tenant via the registration page.

### 8. Run the Application
You need two terminals running simultaneously:

**Terminal 1 (Backend):**
```bash
php artisan serve
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

---

## 🚀 Getting Started

1.  Open your browser at `http://localhost:5173` (or the URL shown by `npm run dev`).
2.  You will be redirected to the **Welcome** page.
3.  Click **"Jetzt Konto erstellen"** (Register) to create a new account.
4.  **Enter your details:**
    *   Company Name (This will become your Tenant Slug)
    *   Email
    *   Password
5.  After registration, you will be redirected to the **Onboarding Wizard** (`/your-company/onboarding`).
6.  Complete the setup (Company Settings, Account Plan Generation).

## Troubleshooting

### WSL / Linux Permissions
If you encounter permission errors on `storage` or `bootstrap/cache`:
```bash
chmod -R 775 storage bootstrap/cache
```

### 500 Internal Server Errors
If you see unexpected 500 errors after updates:
```bash
php artisan optimize:clear
php artisan migrate
```
