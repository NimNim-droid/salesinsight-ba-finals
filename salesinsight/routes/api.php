<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\StoreManagementController;
use Illuminate\Support\Facades\Route;

Route::get('/analytics', [AnalyticsController::class, 'index']);

Route::get('/products', [StoreManagementController::class, 'products']);
Route::post('/products', [StoreManagementController::class, 'storeProduct']);
Route::post('/products/{id}/restock', [StoreManagementController::class, 'restockProduct']);

Route::get('/sales', [StoreManagementController::class, 'sales']);
Route::post('/sales', [StoreManagementController::class, 'storeSale']);

Route::get('/customers', [StoreManagementController::class, 'customers']);
