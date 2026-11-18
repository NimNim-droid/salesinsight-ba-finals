<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('app:ensure-seeded', function () {
    if (DB::table('products')->exists()) {
        $this->info('Database already seeded; skipping.');
        return 0;
    }

    $this->call('db:seed', [
        '--class' => 'Database\\Seeders\\SalesInsightSeeder',
        '--force' => true,
    ]);

    return 0;
})->purpose('Seed sample analytics data only when the database is empty');
