<?php

namespace App\Services;

use App\Models\Product;
use App\Models\InventoryTransaction;
use App\Models\CompanySetting;
use Illuminate\Support\Facades\DB;

class InventoryService
{
    /**
     * Add stock to a product (purchases, returns, corrections)
     */
    public function addStock(
        Product $product,
        float $quantity,
        string $type,
        string $description,
        $reference = null
    ): ?InventoryTransaction {
        // Check if inventory module is enabled
        $settings = CompanySetting::where('tenant_id', $product->tenant_id)->first();
        if (!$settings || !$settings->module_inventory_enabled) {
            return null; // Inventory not enabled, skip
        }

        // Check if product tracks stock
        if (!$product->track_stock) {
            return null; // Product doesn't track stock, skip
        }

        return DB::transaction(function () use ($product, $quantity, $type, $description, $reference) {
            // Update product stock
            $product->stock_quantity += $quantity;
            $product->save();

            // Create transaction record
            $transaction = InventoryTransaction::create([
                'tenant_id' => $product->tenant_id,
                'product_id' => $product->id,
                'quantity' => $quantity,
                'type' => $type,
                'description' => $description,
                'reference_type' => $reference ? get_class($reference) : null,
                'reference_id' => $reference ? $reference->id : null,
                'balance_after' => $product->stock_quantity,
            ]);

            return $transaction;
        });
    }

    /**
     * Remove stock from a product (sales)
     */
    public function removeStock(
        Product $product,
        float $quantity,
        string $type,
        string $description,
        $reference = null
    ): ?InventoryTransaction {
        // Check if inventory module is enabled
        $settings = CompanySetting::where('tenant_id', $product->tenant_id)->first();
        
        \Log::info('InventoryService::removeStock called', [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => $quantity,
            'module_enabled' => $settings ? $settings->module_inventory_enabled : 'no settings',
            'track_stock' => $product->track_stock,
        ]);
        
        if (!$settings || !$settings->module_inventory_enabled) {
            \Log::warning('Inventory module not enabled, skipping stock removal');
            return null; // Inventory not enabled, skip
        }

        // Check if product tracks stock
        if (!$product->track_stock) {
            \Log::warning('Product does not track stock, skipping', ['product_id' => $product->id]);
            return null; // Product doesn't track stock, skip
        }

        return DB::transaction(function () use ($product, $quantity, $type, $description, $reference) {
            // Update product stock (negative quantity)
            $oldStock = $product->stock_quantity;
            $product->stock_quantity -= $quantity;
            $product->save();
            
            \Log::info('Stock reduced', [
                'product_id' => $product->id,
                'old_stock' => $oldStock,
                'new_stock' => $product->stock_quantity,
            ]);

            // Create transaction record with negative quantity
            $transaction = InventoryTransaction::create([
                'tenant_id' => $product->tenant_id,
                'product_id' => $product->id,
                'quantity' => -$quantity,
                'type' => $type,
                'description' => $description,
                'reference_type' => $reference ? get_class($reference) : null,
                'reference_id' => $reference ? $reference->id : null,
                'balance_after' => $product->stock_quantity,
            ]);

            return $transaction;
        });
    }

    /**
     * Perform a stock correction
     */
    public function correctStock(
        Product $product,
        float $newQuantity,
        string $description
    ): ?InventoryTransaction {
        // Check if inventory module is enabled
        $settings = CompanySetting::where('tenant_id', $product->tenant_id)->first();
        if (!$settings || !$settings->module_inventory_enabled) {
            return null;
        }

        // Check if product tracks stock
        if (!$product->track_stock) {
            return null;
        }

        return DB::transaction(function () use ($product, $newQuantity, $description) {
            $difference = $newQuantity - $product->stock_quantity;

            // Update product stock
            $product->stock_quantity = $newQuantity;
            $product->save();

            // Create transaction record
            $transaction = InventoryTransaction::create([
                'tenant_id' => $product->tenant_id,
                'product_id' => $product->id,
                'quantity' => $difference,
                'type' => 'correction',
                'description' => $description,
                'balance_after' => $product->stock_quantity,
            ]);

            return $transaction;
        });
    }
}
