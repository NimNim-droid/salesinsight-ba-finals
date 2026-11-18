FROM php:8.4-cli

# Install system dependencies and PHP database extensions (MySQL, PostgreSQL/Neon, SQLite)
RUN apt-get update && apt-get install -y \
    git unzip libzip-dev libonig-dev libxml2-dev libpq-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_mysql pdo_pgsql pdo_sqlite mbstring zip xml bcmath \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
COPY . .

# Install Laravel dependencies and ensure writable storage/cache/database directories
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && mkdir -p storage/framework/sessions storage/framework/views storage/framework/cache/data storage/logs bootstrap/cache database \
    && touch database/database.sqlite \
    && chmod -R 775 storage bootstrap/cache database

EXPOSE 10000

# Run migrations, seed sample data only if empty, and start the Laravel server on Render's $PORT
CMD sh -c "touch database/database.sqlite && php artisan config:clear && php artisan migrate --force && php artisan app:ensure-seeded && php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"
