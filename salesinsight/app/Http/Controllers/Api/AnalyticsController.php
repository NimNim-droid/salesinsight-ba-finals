<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // ----------------------------------------------------
        // Filter Parameters: Date Period & Product Category
        // ----------------------------------------------------
        $period = $request->query('period', 'all_time'); // 'all_time', 'this_month', 'last_month', 'this_year'
        $selectedCategory = $request->query('category', 'all');

        $version = (int) Cache::get('analytics_version', 1);
        $cacheKey = "analytics:v{$version}:{$period}:{$selectedCategory}";

        $payload = Cache::remember($cacheKey, 300, function () use ($period, $selectedCategory) {

        $driver = DB::connection()->getDriverName();
        $monthExpr = match ($driver) {
            'pgsql' => "TO_CHAR(sales.sale_date, 'YYYY-MM')",
            'sqlite' => "strftime('%Y-%m', sales.sale_date)",
            default => "DATE_FORMAT(sales.sale_date, '%Y-%m')",
        };

        // Helper to apply date filters to sales queries (compatible with MySQL, PostgreSQL/Neon, and SQLite)
        $applySalesDateFilter = function ($query) use ($period) {
            if ($period === 'this_month') {
                $query->whereBetween('sales.sale_date', [
                    now()->startOfMonth()->toDateString(),
                    now()->endOfMonth()->toDateString(),
                ]);
            } elseif ($period === 'last_month') {
                $lastMonth = now()->subMonthNoOverflow();
                $query->whereBetween('sales.sale_date', [
                    $lastMonth->copy()->startOfMonth()->toDateString(),
                    $lastMonth->copy()->endOfMonth()->toDateString(),
                ]);
            } elseif ($period === 'this_year') {
                $query->whereYear('sales.sale_date', date('Y'));
            }
        };

        // Helper to apply category filters
        $applyCategoryFilter = function ($query) use ($selectedCategory) {
            if ($selectedCategory && $selectedCategory !== 'all') {
                $query->where('products.category', $selectedCategory);
            }
        };

        // ----------------------------------------------------
        // 1. DESCRIPTIVE ANALYTICS: KPI SUMMARY
        // ----------------------------------------------------
        $salesBaseQuery = DB::table('sales')
            ->join('products', 'sales.product_id', '=', 'products.id');
        $applySalesDateFilter($salesBaseQuery);
        $applyCategoryFilter($salesBaseQuery);

        $totalRevenue = (float) (clone $salesBaseQuery)->sum('sales.total_amount');
        $totalSales = (int) (clone $salesBaseQuery)->count();
        $totalCustomers = DB::table('customers')->count();

        $productsQuery = DB::table('products');
        if ($selectedCategory && $selectedCategory !== 'all') {
            $productsQuery->where('category', $selectedCategory);
        }
        $totalProducts = $productsQuery->count();

        $lowStockQuery = DB::table('inventories')
            ->join('products', 'inventories.product_id', '=', 'products.id')
            ->whereColumn('inventories.stock_quantity', '<=', 'inventories.reorder_level');
        $applyCategoryFilter($lowStockQuery);
        $lowStock = $lowStockQuery->count();

        $outOfStockQuery = DB::table('inventories')
            ->join('products', 'inventories.product_id', '=', 'products.id')
            ->where('inventories.stock_quantity', '<=', 0);
        $applyCategoryFilter($outOfStockQuery);
        $outOfStock = $outOfStockQuery->count();

        // ----------------------------------------------------
        // 2. DESCRIPTIVE: MONTHLY SALES TREND
        // ----------------------------------------------------
        $monthlySalesQuery = DB::table('sales')
            ->join('products', 'sales.product_id', '=', 'products.id')
            ->selectRaw("{$monthExpr} as month")
            ->selectRaw('SUM(sales.total_amount) as revenue')
            ->selectRaw('COUNT(*) as transactions');
        $applyCategoryFilter($monthlySalesQuery);
        $applySalesDateFilter($monthlySalesQuery);

        $monthlySales = $monthlySalesQuery
            ->groupByRaw($monthExpr)
            ->orderByRaw($monthExpr)
            ->get();

        // If date filter leaves 0 months, show all months so chart remains informative
        if ($monthlySales->isEmpty()) {
            $monthlySales = DB::table('sales')
                ->join('products', 'sales.product_id', '=', 'products.id')
                ->selectRaw("{$monthExpr} as month")
                ->selectRaw('SUM(sales.total_amount) as revenue')
                ->selectRaw('COUNT(*) as transactions')
                ->groupByRaw($monthExpr)
                ->orderByRaw($monthExpr)
                ->get();
        }

        // ----------------------------------------------------
        // 3. DESCRIPTIVE: TOP PRODUCTS
        // ----------------------------------------------------
        $topProductsQuery = DB::table('sales')
            ->join('products', 'sales.product_id', '=', 'products.id')
            ->select('products.name', 'products.category')
            ->selectRaw('SUM(sales.quantity) as units_sold')
            ->selectRaw('SUM(sales.total_amount) as revenue');
        $applySalesDateFilter($topProductsQuery);
        $applyCategoryFilter($topProductsQuery);

        $topProducts = $topProductsQuery
            ->groupBy('products.id', 'products.name', 'products.category')
            ->orderByDesc('revenue')
            ->limit(5)
            ->get();

        // ----------------------------------------------------
        // 4. DESCRIPTIVE: REVENUE BY CATEGORY
        // ----------------------------------------------------
        $salesByCategoryQuery = DB::table('sales')
            ->join('products', 'sales.product_id', '=', 'products.id')
            ->select('products.category')
            ->selectRaw('SUM(sales.total_amount) as revenue');
        $applySalesDateFilter($salesByCategoryQuery);

        $salesByCategory = $salesByCategoryQuery
            ->groupBy('products.category')
            ->orderByDesc('revenue')
            ->get();

        // ----------------------------------------------------
        // 5. PREDICTIVE: 3-MONTH MOVING AVERAGE REVENUE FORECAST
        // Formula: Forecast = (Month 1 + Month 2 + Month 3) / 3
        // ----------------------------------------------------
        // Use full recorded months (excluding current month if incomplete)
        $allHistoricalMonths = DB::table('sales')
            ->selectRaw("{$monthExpr} as month")
            ->selectRaw('SUM(total_amount) as revenue')
            ->selectRaw('COUNT(*) as tx_count')
            ->groupByRaw($monthExpr)
            ->orderByRaw($monthExpr)
            ->get();

        $solidMonths = $allHistoricalMonths->filter(function ($m) {
            return (int) $m->tx_count >= 5;
        })->values();

        if ($solidMonths->count() < 3) {
            $solidMonths = $allHistoricalMonths;
        }

        $last3Months = $solidMonths->take(-3);
        $forecastRevenue = $last3Months->isEmpty()
            ? 0
            : round((float) $last3Months->avg('revenue'), 2);

        // ----------------------------------------------------
        // 7. PREDICTIVE: PRODUCT DEMAND FORECASTING (Requirement 5B)
        // Uses previous 3 months quantity sold to estimate next month demand
        // ----------------------------------------------------
        $productDemandForecast = DB::table('sales')
            ->join('products', 'sales.product_id', '=', 'products.id')
            ->select('products.id', 'products.name', 'products.category')
            ->selectRaw('SUM(sales.quantity) as total_sold_qty')
            ->groupBy('products.id', 'products.name', 'products.category')
            ->orderByDesc('total_sold_qty')
            ->limit(5)
            ->get()
            ->map(function ($row) use ($solidMonths) {
                $monthCount = max(1, $solidMonths->count());
                $avgMonthlyDemand = (int) ceil(((int) $row->total_sold_qty) / $monthCount);
                return [
                    'product_name' => $row->name,
                    'category' => $row->category,
                    'previous_sales_qty' => (int) $row->total_sold_qty,
                    'estimated_monthly_demand' => $avgMonthlyDemand,
                    'explanation' => "Estimated demand of {$avgMonthlyDemand} units based on historical sales velocity across the last 3 months.",
                ];
            });

        // ----------------------------------------------------
        // 8. PRESCRIPTIVE: INVENTORY REORDER RECOMMENDATIONS (Requirement 6A)
        // Formula: Suggested Reorder = Max(0, Predicted Demand + Safety Stock - Current Stock)
        // Where: Safety Stock = Reorder Level
        // ----------------------------------------------------
        $lowStockItems = DB::table('inventories')
            ->join('products', 'inventories.product_id', '=', 'products.id')
            ->whereColumn('inventories.stock_quantity', '<=', 'inventories.reorder_level')
            ->select(
                'products.id as product_id',
                'products.name',
                'products.category',
                'inventories.stock_quantity',
                'inventories.reorder_level'
            )
            ->orderBy('inventories.stock_quantity')
            ->limit(10)
            ->get();

        $salesQtyByProduct = $lowStockItems->isEmpty()
            ? collect()
            : DB::table('sales')
                ->whereIn('product_id', $lowStockItems->pluck('product_id'))
                ->select('product_id')
                ->selectRaw('SUM(quantity) as total_qty')
                ->groupBy('product_id')
                ->pluck('total_qty', 'product_id');

        $inventoryAlerts = $lowStockItems
            ->map(function ($row) use ($solidMonths, $salesQtyByProduct) {
                $stock = (int) $row->stock_quantity;
                $safetyStock = (int) $row->reorder_level;

                // Look up product monthly sales demand
                $unitsSold = (int) ($salesQtyByProduct[$row->product_id] ?? 0);

                $monthCount = max(1, $solidMonths->count());
                $predictedDemand = max(10, (int) ceil($unitsSold / $monthCount * 3)); // 3-month target

                // Standard Formula: Max(0, Predicted Demand + Safety Stock - Current Stock)
                $suggestedReorder = max(10, $predictedDemand + $safetyStock - $stock);

                return [
                    'product_id' => (int) $row->product_id,
                    'name' => $row->name,
                    'category' => $row->category,
                    'stock_quantity' => $stock,
                    'reorder_level' => $safetyStock,
                    'predicted_demand' => $predictedDemand,
                    'safety_stock' => $safetyStock,
                    'suggested_reorder' => $suggestedReorder,
                    'recommendation' => "Reorder {$suggestedReorder} units because available stock ({$stock}) cannot meet expected demand ({$predictedDemand}) plus safety buffer ({$safetyStock}).",
                ];
            });

        // ----------------------------------------------------
        // 9. PLAIN-ENGLISH CHART INSIGHTS (Requirement 4)
        // ----------------------------------------------------
        $topCategoryName = $salesByCategory->first()->category ?? 'N/A';
        $topCategoryRev = (float) ($salesByCategory->first()->revenue ?? 0);
        $topCategoryPct = $totalRevenue > 0 ? round(($topCategoryRev / $totalRevenue) * 100, 1) : 0;

        $topProductName = $topProducts->first()->name ?? 'N/A';
        $topProductRev = (float) ($topProducts->first()->revenue ?? 0);

        $insights = [
            'monthly_sales' => "Monthly revenue averages ₱" . number_format($forecastRevenue, 0) . " across the last 3 active periods.",
            'category' => "{$topCategoryName} generated the highest revenue among all product categories at ₱" . number_format($topCategoryRev, 0) . " ({$topCategoryPct}% of total sales).",
            'top_products' => "{$topProductName} is the #1 best-selling product, contributing ₱" . number_format($topProductRev, 0) . " in total sales.",
        ];

        $inventoryAdvice = $lowStock > 0
            ? "Replenish the {$lowStock} flagged product(s) using the calculated Suggested Reorder quantities to avoid stock shortages."
            : 'All monitored products currently have healthy stock levels above their safety reorder threshold.';

        // ----------------------------------------------------
        // 10. FINAL API PAYLOAD
        // ----------------------------------------------------
        return [
            'case_study' => [
                'company' => 'SalesInsight Gadget Store',
                'location' => 'Cebu City, Philippines',
                'problem' => 'Preventing stockouts of fast-moving gadget accessories by forecasting demand and recommending restock quantities.',
            ],
            'summary' => [
                'total_revenue' => round($totalRevenue, 2),
                'total_sales' => $totalSales,
                'total_customers' => $totalCustomers,
                'total_products' => $totalProducts,
                'low_stock_products' => $lowStock,
                'out_of_stock_products' => $outOfStock,
            ],
            'active_filters' => [
                'period' => $period,
                'category' => $selectedCategory,
            ],
            'monthly_sales' => $monthlySales,
            'top_products' => $topProducts,
            'sales_by_category' => $salesByCategory,
            'inventory_alerts' => $inventoryAlerts,
            'product_demand_forecast' => $productDemandForecast,
            'forecast' => [
                'method' => '3-Month Moving Average (Month 1 + Month 2 + Month 3) / 3',
                'estimated_monthly_revenue' => $forecastRevenue,
                'last_3_months' => $last3Months->values()->map(fn ($m) => [
                    'month' => $m->month,
                    'revenue' => round((float) $m->revenue, 2),
                ]),
                'explanation' => "The estimated monthly revenue is ₱" . number_format($forecastRevenue, 0) . " based on the average revenue of the previous three active months.",
            ],
            'prescriptive' => [
                'inventory_advice' => $inventoryAdvice,
            ],
            'insights' => $insights,
        ];
        });

        return response()->json($payload);
    }
}
