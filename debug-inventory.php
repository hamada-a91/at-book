#!/usr/bin/env php
<?php

// Quick debug script to check inventory setup
require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== Inventory Debug Check ===\n\n";

// 1. Check if product_id column exists in invoice_lines
echo "1. Checking invoice_lines structure:\n";
$columns = DB::select("SELECT column_name FROM information_schema.columns WHERE table_name='invoice_lines'");
$hasProductId = false;
foreach ($columns as $col) {
    if ($col->column_name === 'product_id') {
        $hasProductId = true;
        echo "   ✓ product_id column EXISTS\n";
    }
}
if (!$hasProductId) {
    echo "   ✗ product_id column MISSING - migration not run!\n";
}

// 2. Check module_inventory_enabled setting
echo "\n2. Checking company settings:\n";
$setting = DB::table('company_settings')->first();
if ($setting) {
    echo "   module_inventory_enabled: " . ($setting->module_inventory_enabled ?? 'NOT SET') . "\n";
} else {
    echo "   ✗ No settings found\n";
}

// 3. Check a product
echo "\n3. Checking products:\n";
$product = DB::table('products')->first();
if ($product) {
    echo "   Product: {$product->name}\n";
    echo "   track_stock: " . ($product->track_stock ? 'YES' : 'NO') . "\n";
    echo "   stock_quantity: {$product->stock_quantity}\n";
} else {
    echo "   ✗ No products found\n";
}

// 4. Check recent invoice
echo "\n4. Checking recent invoice:\n";
$invoice = DB::table('invoices')->latest('id')->first();
if ($invoice) {
    echo "   Invoice #{$invoice->id} - Status: {$invoice->status}\n";
    $lines = DB::table('invoice_lines')->where('invoice_id', $invoice->id)->get();
    foreach ($lines as $line) {
        $pid = $line->product_id ?? 'NULL';
        echo "   Line: {$line->description} - product_id: {$pid}\n";
    }
} else {
    echo "   ✗ No invoices found\n";
}

echo "\n=== End Debug ===\n";
