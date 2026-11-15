<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SalesInsightSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            // Clear sample records in dependency order.
            DB::table('inventories')->delete();
            DB::table('sales')->delete();
            DB::table('marketing_campaigns')->delete();
            DB::table('products')->delete();
            DB::table('customers')->delete();

            // 1. Realistic Filipino Customers (50 records)
            $firstNames = [
                'John', 'Maria', 'Carlos', 'Angela', 'Kevin', 'Patricia', 'Mark', 'Bea',
                'Christian', 'Nicole', 'Joshua', 'Camille', 'Daniel', 'Roxanne', 'Jayson',
                'Stephanie', 'Ryan', 'Kaye', 'Jerome', 'Marian', 'Michael', 'Diane', 'Paulo',
                'Janine', 'Anthony', 'Kristine', 'Arvin', 'Denise', 'Gabriel', 'Katrina',
                'Richard', 'Princess', 'Adrian', 'Monique', 'Justin', 'Charmaine', 'Dave',
                'Rowena', 'Kenneth', 'Alyssa', 'Patrick', 'Hazel', 'Angelo', 'Grace',
                'Vincent', 'Samantha', 'Neil', 'Eileen', 'Francis', 'Cynthia'
            ];

            $lastNames = [
                'Santos', 'Garcia', 'Reyes', 'Ramos', 'Mendoza', 'Flores', 'Gonzales',
                'Bautista', 'Villanueva', 'Fernandez', 'Cruz', 'De Guzman', 'Lopez', 'Perez',
                'Castillo', 'Sanchez', 'Torres', 'Rivera', 'Aquino', 'Castro', 'Del Rosario',
                'Navarro', 'Salazar', 'Mercado', 'Tan', 'Lim', 'Sy', 'Chua', 'Go', 'Uy',
                'Yap', 'Ong', 'Abad', 'Alcantara', 'Bernardo', 'Corpuz', 'David', 'Espiritu',
                'Faustino', 'Galang', 'Hernandez', 'Ignacio', 'Javier', 'Lacsamana', 'Manalo',
                'Ocampo', 'Pascual', 'Quinto', 'Romero', 'Tolentino'
            ];

            $cities = [
                'Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Talisay City',
                'Minglanilla', 'Consolacion', 'Toledo City', 'Danao City',
                'Carcar City', 'Naga City'
            ];

            $types = ['Regular', 'VIP', 'New'];

            for ($i = 0; $i < 50; $i++) {
                $fullName = $firstNames[$i] . ' ' . $lastNames[$i];
                $cleanName = strtolower(str_replace(' ', '', $fullName));
                $email = $cleanName . ($i + 1) . '@gmail.com';

                DB::table('customers')->insert([
                    'customer_code' => sprintf('CUS-%03d', $i + 1),
                    'full_name' => $fullName,
                    'email' => $email,
                    'city' => $cities[$i % count($cities)],
                    'customer_type' => $types[$i % count($types)],
                    'created_at' => now()->subDays(180 - ($i * 3)),
                    'updated_at' => now(),
                ]);
            }

            // 2. Realistic Gadget & Electronics Products (50 records: 10 per category)
            $gadgetProducts = [
                // Category: Phone Cases (10 items)
                ['name' => 'Spigen Tough Armor Case for iPhone', 'category' => 'Phone Cases', 'cost' => 380.00, 'price' => 599.00],
                ['name' => 'Nillkin Frosted Shield Case', 'category' => 'Phone Cases', 'cost' => 220.00, 'price' => 350.00],
                ['name' => 'Ringke Fusion Magnetic Clear Case', 'category' => 'Phone Cases', 'cost' => 320.00, 'price' => 499.00],
                ['name' => 'Torras Slim Shockproof Matte Case', 'category' => 'Phone Cases', 'cost' => 450.00, 'price' => 699.00],
                ['name' => 'ESR Air Armor Heavy Duty Case', 'category' => 'Phone Cases', 'cost' => 280.00, 'price' => 450.00],
                ['name' => 'Baseus Liquid Silicone Protective Case', 'category' => 'Phone Cases', 'cost' => 190.00, 'price' => 299.00],
                ['name' => 'OtterBox Symmetry Series Case', 'category' => 'Phone Cases', 'cost' => 750.00, 'price' => 1199.00],
                ['name' => 'UAG Plasma Rugged Transparent Case', 'category' => 'Phone Cases', 'cost' => 850.00, 'price' => 1350.00],
                ['name' => 'X-Level Ultra-Thin Leather Case', 'category' => 'Phone Cases', 'cost' => 240.00, 'price' => 380.00],
                ['name' => 'Caseology Parallax 3D Geometric Case', 'category' => 'Phone Cases', 'cost' => 420.00, 'price' => 650.00],

                // Category: Keyboards (10 items)
                ['name' => 'Keychron K2 Wireless Mechanical Keyboard', 'category' => 'Keyboards', 'cost' => 2300.00, 'price' => 3499.00],
                ['name' => 'Logitech K380 Multi-Device Bluetooth Keyboard', 'category' => 'Keyboards', 'cost' => 1100.00, 'price' => 1699.00],
                ['name' => 'Royal Kludge RK61 RGB 60% Keyboard', 'category' => 'Keyboards', 'cost' => 1350.00, 'price' => 1999.00],
                ['name' => 'Redragon K552 Kumara RGB Mechanical', 'category' => 'Keyboards', 'cost' => 1050.00, 'price' => 1550.00],
                ['name' => 'Akko 3068B Plus Hot-Swap Keyboard', 'category' => 'Keyboards', 'cost' => 1950.00, 'price' => 2899.00],
                ['name' => 'Logitech MX Keys Mini Wireless', 'category' => 'Keyboards', 'cost' => 3100.00, 'price' => 4699.00],
                ['name' => 'A4Tech Fstyler Compact Bluetooth Keyboard', 'category' => 'Keyboards', 'cost' => 450.00, 'price' => 699.00],
                ['name' => 'Razer BlackWidow V3 Tenkeyless', 'category' => 'Keyboards', 'cost' => 2600.00, 'price' => 3899.00],
                ['name' => 'Ajazz AK33 Compact 82-Key Mechanical', 'category' => 'Keyboards', 'cost' => 850.00, 'price' => 1299.00],
                ['name' => 'B.O.W Ultra-Slim Foldable Travel Keyboard', 'category' => 'Keyboards', 'cost' => 620.00, 'price' => 950.00],

                // Category: Chargers (10 items)
                ['name' => 'Anker 20W PowerPort III Nano Fast Charger', 'category' => 'Chargers', 'cost' => 380.00, 'price' => 599.00],
                ['name' => 'Baseus 65W GaN3 Pro USB-C Fast Charger', 'category' => 'Chargers', 'cost' => 850.00, 'price' => 1299.00],
                ['name' => 'Ugreen 30W Nexode Mini GaN Charger', 'category' => 'Chargers', 'cost' => 450.00, 'price' => 699.00],
                ['name' => 'Essager 100W PD Fast Charging Cable (2M)', 'category' => 'Chargers', 'cost' => 120.00, 'price' => 220.00],
                ['name' => 'Joyroom 3-in-1 Foldable Magnetic Stand Charger', 'category' => 'Chargers', 'cost' => 920.00, 'price' => 1450.00],
                ['name' => 'Baseus 20W Super Si Type-C Wall Adapter', 'category' => 'Chargers', 'cost' => 240.00, 'price' => 380.00],
                ['name' => 'Anker 310 Braided USB-C to Lightning Cable', 'category' => 'Chargers', 'cost' => 280.00, 'price' => 450.00],
                ['name' => 'Ugreen 100W 4-Port GaN Desktop Station', 'category' => 'Chargers', 'cost' => 1750.00, 'price' => 2599.00],
                ['name' => 'Toocki 66W 3-in-1 Retractable Cable', 'category' => 'Chargers', 'cost' => 140.00, 'price' => 250.00],
                ['name' => 'Remax 22.5W Fast Charging Car Adapter', 'category' => 'Chargers', 'cost' => 190.00, 'price' => 320.00],

                // Category: Audio (10 items)
                ['name' => 'JBL Go 3 Portable Bluetooth Speaker', 'category' => 'Audio', 'cost' => 1350.00, 'price' => 2199.00],
                ['name' => 'Sony WH-CH520 Wireless Bluetooth Headphones', 'category' => 'Audio', 'cost' => 1800.00, 'price' => 2799.00],
                ['name' => 'Soundcore by Anker Life P2 Mini Earbuds', 'category' => 'Audio', 'cost' => 780.00, 'price' => 1199.00],
                ['name' => 'Edifier X3 TO-U TWS Wireless Earphones', 'category' => 'Audio', 'cost' => 680.00, 'price' => 1050.00],
                ['name' => 'Ugreen 3.5mm HiFi Braided Aux Cable', 'category' => 'Audio', 'cost' => 95.00, 'price' => 180.00],
                ['name' => 'Realme Buds T100 Deep Bass Earbuds', 'category' => 'Audio', 'cost' => 620.00, 'price' => 950.00],
                ['name' => 'Marshall Willen Compact Wireless Speaker', 'category' => 'Audio', 'cost' => 3600.00, 'price' => 5299.00],
                ['name' => 'KZ ZSN Pro Dual Driver In-Ear Monitors', 'category' => 'Audio', 'cost' => 580.00, 'price' => 899.00],
                ['name' => 'Plextone G20 Type-C Gaming Earphones', 'category' => 'Audio', 'cost' => 320.00, 'price' => 499.00],
                ['name' => 'Baseus Wireless Bluetooth 5.3 Audio Receiver', 'category' => 'Audio', 'cost' => 220.00, 'price' => 360.00],

                // Category: Accessories (10 items)
                ['name' => 'Baseus 10000mAh Magnetic Wireless Powerbank', 'category' => 'Accessories', 'cost' => 780.00, 'price' => 1199.00],
                ['name' => 'Orico Aluminum Adjustable Laptop Stand', 'category' => 'Accessories', 'cost' => 420.00, 'price' => 650.00],
                ['name' => 'Ugreen 6-in-1 Multiport USB-C Hub', 'category' => 'Accessories', 'cost' => 890.00, 'price' => 1399.00],
                ['name' => 'ESR 9H Tempered Glass Screen Protector (2-Pack)', 'category' => 'Accessories', 'cost' => 160.00, 'price' => 299.00],
                ['name' => 'Baseus Magnetic Car Dashboard Phone Mount', 'category' => 'Accessories', 'cost' => 210.00, 'price' => 350.00],
                ['name' => 'Anker 325 20000mAh Ultra High Capacity Powerbank', 'category' => 'Accessories', 'cost' => 1150.00, 'price' => 1799.00],
                ['name' => 'Dobe Universal Foldable Tablet Holder Stand', 'category' => 'Accessories', 'cost' => 130.00, 'price' => 230.00],
                ['name' => 'Baseus Reusable Silicone Cable Straps (5-Pack)', 'category' => 'Accessories', 'cost' => 65.00, 'price' => 120.00],
                ['name' => 'Logitech G240 Cloth Gaming Mousepad', 'category' => 'Accessories', 'cost' => 450.00, 'price' => 699.00],
                ['name' => 'SanDisk Ultra 128GB MicroSD Card with Adapter', 'category' => 'Accessories', 'cost' => 360.00, 'price' => 550.00],
            ];

            foreach ($gadgetProducts as $idx => $p) {
                DB::table('products')->insert([
                    'product_code' => sprintf('PRD-%03d', $idx + 1),
                    'name' => $p['name'],
                    'category' => $p['category'],
                    'price' => $p['price'],
                    'cost_price' => $p['cost'],
                    'created_at' => now()->subDays(180),
                    'updated_at' => now(),
                ]);
            }

            // 3. Realistic Marketing Campaigns (50 records)
            $platforms = ['TikTok', 'Instagram', 'Google Ads', 'Facebook', 'Email'];
            $campaignThemes = [
                'Mega 11.11 Gadget Promo', 'Payday Weekend Flash Deal', 'Back-to-School Tech Essentials',
                'Cebu Summer Sale Event', 'New Year Gadget Upgrade', 'Free Shipping Festival',
                'Midnight Clearance Flash', 'Audio & Speaker Spotlight', 'Work-From-Home Gear Sale',
                'Fast Charger & Battery Fest'
            ];

            for ($i = 0; $i < 50; $i++) {
                $platform = $platforms[$i % count($platforms)];
                $theme = $campaignThemes[$i % count($campaignThemes)];
                $start = now()->subDays(175 - ($i * 3))->startOfDay();

                // Realistic performance per platform:
                // TikTok: highest efficiency (lowest cost per conversion ~P45-52)
                // Google/IG: balanced (~P50-55)
                // FB/Email: slightly higher CPA (~P55-65)
                $budget = 1500.00 + (($i * 320) % 3500);
                $spend = round($budget * (0.85 + (($i % 15) / 100)), 2);
                $clicks = 120 + (($i * 65) % 1500);

                if ($platform === 'TikTok') {
                    $conv = max(12, (int) round($spend / 46.50));
                } elseif ($platform === 'Google Ads') {
                    $conv = max(10, (int) round($spend / 51.20));
                } elseif ($platform === 'Instagram') {
                    $conv = max(10, (int) round($spend / 52.80));
                } elseif ($platform === 'Facebook') {
                    $conv = max(8, (int) round($spend / 57.50));
                } else { // Email
                    $conv = max(7, (int) round($spend / 58.20));
                }

                DB::table('marketing_campaigns')->insert([
                    'campaign_code' => sprintf('CAM-%03d', $i + 1),
                    'campaign_name' => "$theme - $platform " . (intval($i / 5) + 1),
                    'platform' => $platform,
                    'start_date' => $start->toDateString(),
                    'end_date' => $start->copy()->addDays(5)->toDateString(),
                    'budget' => $budget,
                    'actual_spend' => $spend,
                    'clicks' => $clicks,
                    'conversions' => $conv,
                    'created_at' => $start,
                    'updated_at' => now(),
                ]);
            }

            // 4. Realistic Sales Transactions (120 records spread across May to Nov)
            $customerIds = DB::table('customers')->orderBy('id')->pluck('id')->all();
            $products = DB::table('products')->orderBy('id')->get();
            $paymentMethods = ['GCash', 'Cash', 'Card', 'Maya'];

            for ($i = 0; $i < 120; $i++) {
                $customerId = $customerIds[($i * 7) % count($customerIds)];
                // Distribute products with higher weights to fast-moving items (chargers, cases, audio)
                $productIndex = ($i * 11) % count($products);
                $product = $products[$productIndex];

                $qty = 1 + (($i * 3) % 4); // 1 to 4 units
                $price = (float) $product->price;
                $total = round($price * $qty, 2);

                // Date distribution over the last 180 days (6 months)
                $daysAgo = (int) (180 - ($i * 1.45));
                $saleDate = now()->subDays(max(0, $daysAgo))->toDateString();

                DB::table('sales')->insert([
                    'transaction_code' => sprintf('SAL-%04d', $i + 1),
                    'customer_id' => $customerId,
                    'product_id' => $product->id,
                    'sale_date' => $saleDate,
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'total_amount' => $total,
                    'payment_method' => $paymentMethods[$i % count($paymentMethods)],
                    'created_at' => $saleDate,
                    'updated_at' => now(),
                ]);
            }

            // 5. Realistic Inventories (50 records: 1 per product)
            $locations = ['Main Store - Ayala Cebu', 'SM City Cebu Branch', 'IT Park Hub'];

            foreach ($products as $idx => $product) {
                // Designate 8-10 specific products to be low in stock (below or equal to reorder level)
                // to showcase the Prescriptive Analytics Inventory Alert feature
                $isLowStock = in_array($idx + 1, [3, 8, 12, 18, 22, 28, 33, 41]);

                if ($isLowStock) {
                    $reorderLevel = 15 + ($idx % 10); // e.g. 15 to 24
                    $stockQuantity = max(1, 1 + ($idx % 5)); // e.g. 1 to 5 units (Critically low!)
                } else {
                    $reorderLevel = 10 + ($idx % 15);
                    $stockQuantity = 25 + (($idx * 17) % 60); // 25 to 80 units (Healthy)
                }

                DB::table('inventories')->insert([
                    'product_id' => $product->id,
                    'location' => $locations[$idx % count($locations)],
                    'stock_quantity' => $stockQuantity,
                    'reorder_level' => $reorderLevel,
                    'last_restocked_at' => now()->subDays(10 + ($idx % 40))->toDateString(),
                    'created_at' => now()->subDays(180),
                    'updated_at' => now(),
                ]);
            }
        });
    }
}
