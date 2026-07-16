<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Seriennummern-Aktivierung
    |--------------------------------------------------------------------------
    | Wenn aktiv, verlangt die Registrierung eine gültige Seriennummer
    | (Verwaltung über /api/admin/serial-numbers).
    | Immer über config('atbook.serial_number_activation') abfragen –
    | env() direkt im Code bricht bei aktiviertem config:cache!
    */
    'serial_number_activation' => (bool) env('ENABLE_SERIAL_NUMBER_ACTIVATION', false),

    /*
    |--------------------------------------------------------------------------
    | Plattform-Admin (AdminUserSeeder)
    |--------------------------------------------------------------------------
    | Ohne ADMIN_PASSWORD generiert der Seeder ein Zufallspasswort und gibt
    | es einmalig auf der Konsole aus. Niemals Passwörter committen.
    */
    'admin_email' => env('ADMIN_EMAIL', 'admin@at-book.local'),
    'admin_name' => env('ADMIN_NAME', 'Plattform Admin'),
    'admin_password' => env('ADMIN_PASSWORD'),

];
