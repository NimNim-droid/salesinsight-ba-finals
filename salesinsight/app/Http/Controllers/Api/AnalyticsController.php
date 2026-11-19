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

        // Cache the raw dataset once across all filter combinations (4 fast queries instead of 12 per click)
        $snapshot = Cache::remember("store_snapshot:v{$version}", 300, function () {
            return [
                'products' => DB::table('products')
                    ->select('id', 'name', 'category', 'price')
                    ->get()
                    ->all(),
                'sales' => DB::table('sales')
                    ->select('id', 'customer_id', 'product_id', 'sale_date', 'quantity', 'total_amount')
                    ->get()
                    ->all(),
                'inventories' => DB::table('inventories')
                    ->select('product_id', 'stock_quantity', 'reorder_level')
                    ->get()
                    ->all(),
                'total_customers' => DB::table('customers')->count(),
            ];
        });

        $productsById = [];
        foreach ($snapshot['products'] as $product) {
            $productsById[(int) $product->id] = $product;
        }

        // Date bounds for active filter
        $startDate = null;
        $endDate = null;
        if ($period === 'this_month') {
            $startDate = now()->startOfMonth()->toDateString();
            $endDate = now()->endOfMonth()->toDateString();
        } elseif ($period === 'last_month') {
            $lastMonth = now()->subMonthNoOverflow();
            $startDate = $lastMonth->copy()->startOfMonth()->toDateString();
            $endDate = $lastMonth->copy()->endOfMonth()->toDateString();
        } elseif ($period === 'this_year') {
            $startDate = date('Y') . '-01-01';
            $endDate = date('Y') . '-12-31';
        }

        $isCategoryFiltered = $selectedCategory && $selectedCategory !== 'all';
        $isFiltered = $period !== 'all_time' || $isCategoryFiltered;

        // Filter sales in memory (zero extra database round-trips when clicking dropdowns)
        $dateFilteredSales = [];
        $filteredSales = [];
        foreach ($snapshot['sales'] as $sale) {
            $product = $productsById[(int) $sale->product_id] ?? null;
            if (!$product) {
                continue;
            }

            $saleDate = substr((string) $sale->sale_date, 0, 10);
            if ($startDate !== null && ($saleDate < $startDate || $saleDate > $endDate)) {
                continue;
            }

            $dateFilteredSales[] = $sale;

            if (!$isCategoryFiltered || $product->category === $selectedCategory) {
                $filteredSales[] = $sale;
            }
        }

        // ----------------------------------------------------
        // 1. DESCRIPTIVE ANALYTICS: KPI SUMMARY
        // ----------------------------------------------------
        $totalRevenue = 0.0;
        $activeBuyerIds = [];
        foreach ($filteredSales as $sale) {
            $totalRevenue += (float) $sale->total_amount;
            if ($sale->customer_id !== null) {
                $activeBuyerIds[(int) $sale->customer_id] = true;
            }
        }
        $totalSales = count($filteredSales);
        $totalCustomers = $isFiltered
            ? count($activeBuyerIds)
            : (int) $snapshot['total_customers'];

        $totalProducts = 0;
        foreach ($snapshot['products'] as $product) {
            if (!$isCategoryFiltered || $product->category === $selectedCategory) {
                $totalProducts++;
            }
        }

        $lowStock = 0;
        $outOfStock = 0;
        foreach ($snapshot['inventories'] as $inv) {
            $product = $productsById[(int) $inv->product_id] ?? null;
            if (!$product || ($isCategoryFiltered && $product->category !== $selectedCategory)) {
                continue;
            }
            $stock = (int) $inv->stock_quantity;
            $reorder = (int) $inv->reorder_level;
            if ($stock <= $reorder) {
                $lowStock++;
            }
            if ($stock <= 0) {
                $outOfStock++;
            }
        }

        // ----------------------------------------------------
        // 2. DESCRIPTIVE: SALES TREND (Daily for single-month filters, Monthly otherwise)
        // ----------------------------------------------------
        $trendGranularity = in_array($period, ['this_month', 'last_month'], true) ? 'daily' : 'monthly';
        $trendBuckets = [];
        foreach ($filteredSales as $sale) {
            $saleDate = substr((string) $sale->sale_date, 0, 10);
            $bucketKey = $trendGranularity === 'daily' ? $saleDate : substr($saleDate, 0, 7);
            if (!isset($trendBuckets[$bucketKey])) {
                $trendBuckets[$bucketKey] = [
                    'month' => $bucketKey,
                    'revenue' => 0.0,
                    'transactions' => 0,
                ];
            }
            $trendBuckets[$bucketKey]['revenue'] += (float) $sale->total_amount;
            $trendBuckets[$bucketKey]['transactions']++;
        }
        ksort($trendBuckets);
        $monthlySales = array_values(array_map(function ($row) {
            $row['revenue'] = round($row['revenue'], 2);
            return $row;
        }, $trendBuckets));

        // ----------------------------------------------------
        // 3. DESCRIPTIVE: TOP PRODUCTS
        // ----------------------------------------------------
        $productStats = [];
        foreach ($filteredSales as $sale) {
            $pid = (int) $sale->product_id;
            $product = $productsById[$pid];
            if (!isset($productStats[$pid])) {
                $productStats[$pid] = [
                    'name' => $product->name,
                    'category' => $product->category,
                    'units_sold' => 0,
                    'revenue' => 0.0,
                ];
            }
            $productStats[$pid]['units_sold'] += (int) $sale->quantity;
            $productStats[$pid]['revenue'] += (float) $sale->total_amount;
        }
        usort($productStats, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);
        $topProducts = array_map(function ($row) {
            $row['revenue'] = round($row['revenue'], 2);
            return $row;
        }, array_slice($productStats, 0, 5));

        // ----------------------------------------------------
        // 4. DESCRIPTIVE: REVENUE BY CATEGORY
        // ----------------------------------------------------
        $categoryTotals = [];
        foreach ($dateFilteredSales as $sale) {
            $product = $productsById[(int) $sale->product_id];
            $cat = $product->category;
            if (!isset($categoryTotals[$cat])) {
                $categoryTotals[$cat] = ['category' => $cat, 'revenue' => 0.0];
            }
            $categoryTotals[$cat]['revenue'] += (float) $sale->total_amount;
        }
        usort($categoryTotals, fn ($a, $b) => $b['revenue'] <=> $a['revenue']);
        $salesByCategory = array_map(function ($row) {
            $row['revenue'] = round($row['revenue'], 2);
            return $row;
        }, array_values($categoryTotals));

        // ----------------------------------------------------
        // 5. PREDICTIVE: 3-MONTH MOVING AVERAGE REVENUE FORECAST
        // Formula: Forecast = (Month 1 + Month 2 + Month 3) / 3
        // ----------------------------------------------------
        $historicalMonthsMap = [];
        $allTimeQtyByProduct = [];
        foreach ($snapshot['sales'] as $sale) {
            $saleDate = substr((string) $sale->sale_date, 0, 10);
            $monthKey = substr($saleDate, 0, 7);
            if (!isset($historicalMonthsMap[$monthKey])) {
                $historicalMonthsMap[$monthKey] = [
                    'month' => $monthKey,
                    'revenue' => 0.0,
                    'tx_count' => 0,
                ];
            }
            $historicalMonthsMap[$monthKey]['revenue'] += (float) $sale->total_amount;
            $historicalMonthsMap[$monthKey]['tx_count']++;

            $pid = (int) $sale->product_id;
            $allTimeQtyByProduct[$pid] = ($allTimeQtyByProduct[$pid] ?? 0) + (int) $sale->quantity;
        }
        ksort($historicalMonthsMap);
        $allHistoricalMonths = collect(array_values($historicalMonthsMap));

        $solidMonths = $allHistoricalMonths
            ->filter(fn ($m) => (int) $m['tx_count'] >= 5)
            ->values();

        if ($solidMonths->count() < 3) {
            $solidMonths = $allHistoricalMonths;
        }

        $last3Months = $solidMonths->take(-3)->values();
        $forecastRevenue = $last3Months->isEmpty()
            ? 0
            : round((float) $last3Months->avg('revenue'), 2);

        $monthCount = max(1, $solidMonths->count());

        // ----------------------------------------------------
        // 6. PREDICTIVE: PRODUCT DEMAND FORECASTING
        // ----------------------------------------------------
        arsort($allTimeQtyByProduct);
        $productDemandForecast = [];
        foreach (array_slice($allTimeQtyByProduct, 0, 5, true) as $pid => $totalQty) {
            $product = $productsById[$pid] ?? null;
            if (!$product) {
                continue;
            }
            $avgMonthlyDemand = (int) ceil($totalQty / $monthCount);
            $productDemandForecast[] = [
                'product_name' => $product->name,
                'category' => $product->category,
                'previous_sales_qty' => (int) $totalQty,
                'estimated_monthly_demand' => $avgMonthlyDemand,
                'explanation' => "Estimated demand of {$avgMonthlyDemand} units based on historical sales velocity across the last 3 months.",
            ];
        }

        // ----------------------------------------------------
        // 7. PRESCRIPTIVE: INVENTORY REORDER RECOMMENDATIONS
        // Formula: Suggested Reorder = Max(0, Predicted Demand + Safety Stock - Current Stock)
        // ----------------------------------------------------
        $lowStockItems = [];
        foreach ($snapshot['inventories'] as $inv) {
            $stock = (int) $inv->stock_quantity;
            $reorder = (int) $inv->reorder_level;
            $product = $productsById[(int) $inv->product_id] ?? null;
            if (!$product || $stock > $reorder) {
                continue;
            }
            $lowStockItems[] = [
                'product_id' => (int) $product->id,
                'name' => $product->name,
                'category' => $product->category,
                'stock_quantity' => $stock,
                'reorder_level' => $reorder,
            ];
        }
        usort($lowStockItems, fn ($a, $b) => $a['stock_quantity'] <=> $b['stock_quantity']);
        $lowStockItems = array_slice($lowStockItems, 0, 10);

        $inventoryAlerts = array_map(function ($row) use ($monthCount, $allTimeQtyByProduct) {
            $stock = $row['stock_quantity'];
            $safetyStock = $row['reorder_level'];
            $unitsSold = (int) ($allTimeQtyByProduct[$row['product_id']] ?? 0);

            $predictedDemand = max(10, (int) ceil($unitsSold / $monthCount * 3));
            $suggestedReorder = max(10, $predictedDemand + $safetyStock - $stock);

            return [
                'product_id' => $row['product_id'],
                'name' => $row['name'],
                'category' => $row['category'],
                'stock_quantity' => $stock,
                'reorder_level' => $safetyStock,
                'predicted_demand' => $predictedDemand,
                'safety_stock' => $safetyStock,
                'suggested_reorder' => $suggestedReorder,
                'recommendation' => "Reorder {$suggestedReorder} units because available stock ({$stock}) cannot meet expected demand ({$predictedDemand}) plus safety buffer ({$safetyStock}).",
            ];
        }, $lowStockItems);

        // ----------------------------------------------------
        // 8. PLAIN-ENGLISH CHART INSIGHTS
        // ----------------------------------------------------
        $topCategoryName = $salesByCategory[0]['category'] ?? 'N/A';
        $topCategoryRev = (float) ($salesByCategory[0]['revenue'] ?? 0);
        $dateTotalRevenue = array_sum(array_column($salesByCategory, 'revenue'));
        $topCategoryPct = $dateTotalRevenue > 0 ? round(($topCategoryRev / $dateTotalRevenue) * 100, 1) : 0;

        $topProductName = $topProducts[0]['name'] ?? 'N/A';
        $topProductRev = (float) ($topProducts[0]['revenue'] ?? 0);

        $periodSalesInsight = $totalSales > 0
            ? ($trendGranularity === 'daily'
                ? "Recorded ₱" . number_format($totalRevenue, 0) . " across {$totalSales} order(s) in this period."
                : "Monthly revenue averages ₱" . number_format($forecastRevenue, 0) . " across the last 3 active periods.")
            : 'No sales recorded for this filter selection yet.';

        $insights = [
            'monthly_sales' => $periodSalesInsight,
            'category' => $topCategoryRev > 0
                ? "{$topCategoryName} generated the highest revenue among all product categories at ₱" . number_format($topCategoryRev, 0) . " ({$topCategoryPct}% of period sales)."
                : 'No category revenue recorded for this period.',
            'top_products' => $topProductRev > 0
                ? "{$topProductName} is the #1 best-selling product, contributing ₱" . number_format($topProductRev, 0) . " in sales."
                : 'No product sales recorded for this filter.',
        ];

        $totalFlaggedAllCategories = count($lowStockItems);
        $inventoryAdvice = $totalFlaggedAllCategories > 0
            ? "Replenish the {$totalFlaggedAllCategories} flagged product(s) using the calculated Suggested Reorder quantities to avoid stock shortages."
            : 'All monitored products currently have healthy stock levels above their safety reorder threshold.';

        // ----------------------------------------------------
        // 9. FINAL API PAYLOAD
        // ----------------------------------------------------
        return response()->json([
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
            'trend_granularity' => $trendGranularity,
            'monthly_sales' => $monthlySales,
            'top_products' => $topProducts,
            'sales_by_category' => $salesByCategory,
            'inventory_alerts' => $inventoryAlerts,
            'product_demand_forecast' => $productDemandForecast,
            'forecast' => [
                'method' => '3-Month Moving Average (Month 1 + Month 2 + Month 3) / 3',
                'estimated_monthly_revenue' => $forecastRevenue,
                'last_3_months' => $last3Months->map(fn ($m) => [
                    'month' => $m['month'],
                    'revenue' => round((float) $m['revenue'], 2),
                ])->all(),
                'explanation' => "The estimated monthly revenue is ₱" . number_format($forecastRevenue, 0) . " based on the average revenue of the previous three active months.",
            ],
            'prescriptive' => [
                'inventory_advice' => $inventoryAdvice,
            ],
            'insights' => $insights,
        ]);
    }
}
