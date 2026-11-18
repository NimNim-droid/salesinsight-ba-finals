<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StoreManagementController extends Controller
{
    private function invalidateAnalyticsCache(): void
    {
        Cache::forever('analytics_version', ((int) Cache::get('analytics_version', 1)) + 1);
    }
    public function products(): JsonResponse
    {
        $products = DB::table('products')
            ->leftJoin('inventories', 'products.id', '=', 'inventories.product_id')
            ->select(
                'products.id',
                'products.product_code',
                'products.name',
                'products.category',
                'products.price',
                'products.cost_price',
                DB::raw('COALESCE(inventories.stock_quantity, 0) as stock_quantity'),
                DB::raw('COALESCE(inventories.reorder_level, 10) as reorder_level'),
                DB::raw("COALESCE(inventories.location, 'Main Store - Ayala Cebu') as location")
            )
            ->orderByDesc('products.id')
            ->get()
            ->map(function ($row) {
                $stock = (int) $row->stock_quantity;
                $reorder = (int) $row->reorder_level;

                $status = $stock === 0
                    ? 'Out of Stock'
                    : ($stock <= $reorder ? 'Low Stock' : 'Healthy');

                return [
                    'id' => (int) $row->id,
                    'product_code' => $row->product_code,
                    'name' => $row->name,
                    'category' => $row->category,
                    'price' => (float) $row->price,
                    'cost_price' => (float) $row->cost_price,
                    'stock_quantity' => $stock,
                    'reorder_level' => $reorder,
                    'location' => $row->location,
                    'status' => $status,
                ];
            });

        return response()->json(['products' => $products]);
    }

    public function storeProduct(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'category' => ['required', 'string', 'max:80'],
            'price' => ['required', 'numeric', 'min:1', 'max:999999'],
            'cost_price' => ['nullable', 'numeric', 'min:0', 'max:999999'],
            'stock_quantity' => ['required', 'integer', 'min:0', 'max:100000'],
            'reorder_level' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'location' => ['nullable', 'string', 'max:120'],
        ]);

        $price = round((float) $validated['price'], 2);
        $costPrice = isset($validated['cost_price'])
            ? round((float) $validated['cost_price'], 2)
            : round($price * 0.65, 2);
        $stockQty = (int) $validated['stock_quantity'];
        $reorderLevel = (int) ($validated['reorder_level'] ?? 15);
        $location = ($validated['location'] ?? null) ?: 'Main Store - Ayala Cebu';

        $createdId = DB::transaction(function () use ($validated, $price, $costPrice, $stockQty, $reorderLevel, $location) {
            $nextNumber = ((int) DB::table('products')->max('id')) + 1;
            $code = sprintf('PRD-%03d', $nextNumber);
            while (DB::table('products')->where('product_code', $code)->exists()) {
                $nextNumber++;
                $code = sprintf('PRD-%03d', $nextNumber);
            }

            $now = now();
            $productId = DB::table('products')->insertGetId([
                'product_code' => $code,
                'name' => trim($validated['name']),
                'category' => trim($validated['category']),
                'price' => $price,
                'cost_price' => $costPrice,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('inventories')->insert([
                'product_id' => $productId,
                'location' => $location,
                'stock_quantity' => $stockQty,
                'reorder_level' => $reorderLevel,
                'last_restocked_at' => $now->toDateString(),
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            return $productId;
        });

        $this->invalidateAnalyticsCache();

        return response()->json([
            'message' => 'Product added successfully.',
            'product_id' => $createdId,
        ], 201);
    }

    public function restockProduct(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:10000'],
        ]);

        $inventory = DB::table('inventories')->where('product_id', $id)->first();
        if (!$inventory) {
            return response()->json(['message' => 'Product inventory record not found.'], 404);
        }

        $addedQty = (int) $validated['quantity'];
        DB::table('inventories')
            ->where('product_id', $id)
            ->update([
                'stock_quantity' => (int) $inventory->stock_quantity + $addedQty,
                'last_restocked_at' => now()->toDateString(),
                'updated_at' => now(),
            ]);

        $this->invalidateAnalyticsCache();

        return response()->json([
            'message' => "Added {$addedQty} units to stock.",
            'new_stock' => (int) $inventory->stock_quantity + $addedQty,
        ]);
    }

    public function sales(): JsonResponse
    {
        $sales = DB::table('sales')
            ->join('products', 'sales.product_id', '=', 'products.id')
            ->leftJoin('customers', 'sales.customer_id', '=', 'customers.id')
            ->select(
                'sales.id',
                'sales.transaction_code',
                'sales.sale_date',
                'sales.quantity',
                'sales.unit_price',
                'sales.total_amount',
                'sales.payment_method',
                'products.name as product_name',
                'products.category as product_category',
                DB::raw("COALESCE(customers.full_name, 'Walk-in Customer') as customer_name")
            )
            ->orderByDesc('sales.sale_date')
            ->orderByDesc('sales.id')
            ->limit(50)
            ->get();

        return response()->json(['sales' => $sales]);
    }

    public function storeSale(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:1000'],
            'payment_method' => ['required', 'string', 'in:GCash,Cash,Card,Maya'],
            'sale_date' => ['nullable', 'date'],
        ]);

        $qty = (int) $validated['quantity'];
        $saleDate = $validated['sale_date'] ?? now()->toDateString();

        $saleId = DB::transaction(function () use ($validated, $qty, $saleDate) {
            $product = DB::table('products')->where('id', $validated['product_id'])->first();
            $inventory = DB::table('inventories')
                ->where('product_id', $validated['product_id'])
                ->lockForUpdate()
                ->first();

            $availableStock = $inventory ? (int) $inventory->stock_quantity : 0;
            if ($availableStock < $qty) {
                throw ValidationException::withMessages([
                    'quantity' => ["Only {$availableStock} unit(s) available in stock for {$product->name}."],
                ]);
            }

            $customerId = $validated['customer_id'] ?? DB::table('customers')->orderBy('id')->value('id');
            if (!$customerId) {
                $customerId = DB::table('customers')->insertGetId([
                    'customer_code' => 'CUS-WALKIN',
                    'full_name' => 'Walk-in Customer',
                    'email' => 'walkin@salesinsight.local',
                    'city' => 'Cebu City',
                    'customer_type' => 'Regular',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $nextNumber = ((int) DB::table('sales')->max('id')) + 1;
            $code = sprintf('SAL-%04d', $nextNumber);
            while (DB::table('sales')->where('transaction_code', $code)->exists()) {
                $nextNumber++;
                $code = sprintf('SAL-%04d', $nextNumber);
            }

            $unitPrice = (float) $product->price;
            $totalAmount = round($unitPrice * $qty, 2);
            $now = now();

            $id = DB::table('sales')->insertGetId([
                'transaction_code' => $code,
                'customer_id' => $customerId,
                'product_id' => $product->id,
                'sale_date' => $saleDate,
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'total_amount' => $totalAmount,
                'payment_method' => $validated['payment_method'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if ($inventory) {
                DB::table('inventories')
                    ->where('id', $inventory->id)
                    ->update([
                        'stock_quantity' => $availableStock - $qty,
                        'updated_at' => $now,
                    ]);
            }

            return $id;
        });

        $this->invalidateAnalyticsCache();

        return response()->json([
            'message' => 'Sale recorded and inventory updated.',
            'sale_id' => $saleId,
        ], 201);
    }

    public function customers(): JsonResponse
    {
        $customers = DB::table('customers')
            ->select('id', 'customer_code', 'full_name', 'city', 'customer_type')
            ->orderBy('full_name')
            ->get();

        return response()->json(['customers' => $customers]);
    }
}
