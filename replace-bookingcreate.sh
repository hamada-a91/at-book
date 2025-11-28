#!/bin/bash

echo "🔧 BookingCreate.tsx ersetzen"
echo "=============================="
echo ""

# Wechsle ins Projektverzeichnis
cd /home/ahmed/LaravelProjects/at-book

echo "1. Backup erstellen..."
cp resources/js/pages/BookingCreate.tsx resources/js/pages/BookingCreate.BACKUP.$(date +%Y%m%d_%H%M%S).tsx 2>/dev/null || echo "   (kein Backup nötig)"

echo ""
echo "2. Neue Datei kopieren..."
cp resources/js/pages/BookingCreate.NEW.tsx resources/js/pages/BookingCreate.tsx

echo ""
echo "✅ Fertig!"
echo ""
echo "🚨 WICHTIG: Bitte schließe BookingCreate.tsx in deinem Editor und öffne es neu!"
echo ""
echo "Dann teste:"
echo "- npm run dev (falls nicht läuft)"
echo "- Gehe zu 'Neue Buchung'"
echo "- Teste mit 'Direkt bezahlt' Checkbox"
