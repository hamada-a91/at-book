#!/bin/bash

echo "🚀 AT-Book Account Setup"
echo "========================"
echo ""

cd /home/ahmed/LaravelProjects/at-book

echo "1️⃣ Migration ausführen..."
./vendor/bin/sail artisan migrate

echo ""
echo "2️⃣ Account Seeder ausführen..."
./vendor/bin/sail artisan db:seed --class=AccountSeeder

echo ""
echo "✅ Fertig! Alle Konten wurden geladen."
echo ""
echo "📊 Geladene Konten:"
echo "   - 1000: Kasse"
echo "   - 1200: Bank"  
echo "   - 1576: Vorsteuer 19%"
echo "   - 1571: Vorsteuer 7%"
echo "   - 1776: Umsatzsteuer 19%"
echo "   - 1771: Umsatzsteuer 7%"
echo "   - 8400: Erlöse 19%"
echo "   - 8300: Erlöse 7%"
echo "   - 8100: Steuerfreie Umsätze"
echo "   - 3400: Wareneingang 19%"
echo "   - 4930: Bürobedarf"
echo "   - 4980: Betriebsbedarf"
echo ""
echo "🎉 Du kannst jetzt BookingCreate.NEW.tsx verwenden!"
