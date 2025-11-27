#!/bin/bash

# Navigate to project directory
cd /home/ahmed/LaravelProjects/at-book

# Run migration
./vendor/bin/sail artisan migrate

# Link storage for logo uploads
./vendor/bin/sail artisan storage:link

echo "✅ Migration complete! Company settings table created."
echo "✅ Storage linked! Logo uploads will work."
echo ""
echo "Now visit http://localhost/settings to configure your company settings!"
