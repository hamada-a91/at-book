#!/bin/bash

# Navigate to project directory
cd /home/ahmed/LaravelProjects/at-book

# Run migration
./vendor/bin/sail artisan migrate

echo "✅ Migration complete! Contacts table updated with new fields."
echo ""
echo "Now test the updated contacts page at http://localhost/contacts"
