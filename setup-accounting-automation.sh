#!/bin/bash

echo "🚀 AT-Book Accounting Automation Setup"
echo "========================================"
echo ""

cd /home/ahmed/LaravelProjects/at-book

echo "📊 Step 1: Running migrations..."
./vendor/bin/sail artisan migrate

echo ""
echo "🌱 Step 2: Seeding VAT accounts..."
./vendor/bin/sail artisan db:seed --class=AccountSeeder

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Create a new Contact (Customer/Vendor) to test automatic account creation"
echo "2. Go to 'Neue Buchung' and try the Quick Entry feature"
echo ""
echo "For more details, see IMPLEMENTATION_SUMMARY.md"
