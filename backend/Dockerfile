FROM php:8.2-apache-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    zip \
    libpng-dev \
    libjpeg-dev \
    libwebp-dev \
    libfreetype6-dev \
    libicu-dev \
    libxml2-dev \
    libzip-dev \
    sqlite3 \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
        gd \
        intl \
        opcache \
        pdo_sqlite \
        xml \
        zip \
    && docker-php-ext-enable opcache

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set Apache DocumentRoot
ENV APACHE_DOCUMENT_ROOT /var/www/html/web

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
    /etc/apache2/sites-available/*.conf \
    /etc/apache2/apache2.conf \
    /etc/apache2/conf-available/*.conf

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# PHP configuration for Drupal
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" && \
    echo "memory_limit = 256M" >> "$PHP_INI_DIR/php.ini" && \
    echo "upload_max_filesize = 32M" >> "$PHP_INI_DIR/php.ini" && \
    echo "post_max_size = 32M" >> "$PHP_INI_DIR/php.ini" && \
    echo "max_execution_time = 300" >> "$PHP_INI_DIR/php.ini" && \
    echo "opcache.enable=1" >> "$PHP_INI_DIR/conf.d/docker-php-ext-opcache.ini" && \
    echo "opcache.memory_consumption=128" >> "$PHP_INI_DIR/conf.d/docker-php-ext-opcache.ini"

WORKDIR /var/www/html

# Copy composer files
COPY composer.json composer.lock* ./

# Install Drupal and dependencies
RUN composer install --no-dev --optimize-autoloader 2>&1 || \
    composer install --no-dev 2>&1

# Copy custom modules
COPY modules/ web/modules/custom/

# Copy configuration
COPY config/ config/

# Copy services template
COPY services.yml.template /var/www/html/services.yml.template

# Add Drush to PATH
RUN ln -s /var/www/html/vendor/bin/drush /usr/local/bin/drush

# Install Stripe CLI for webhook testing
RUN curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | tee /usr/share/keyrings/stripe.gpg > /dev/null && \
    echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | tee /etc/apt/sources.list.d/stripe.list && \
    apt-get update && \
    apt-get install -y stripe && \
    rm -rf /var/lib/apt/lists/* || true

# Set file permissions
# Codebase: owned by www-data but not writable by web server
RUN chown -R www-data:www-data /var/www/html && \
    find /var/www/html -type d -exec chmod 750 {} \; && \
    find /var/www/html -type f -exec chmod 640 {} \;

# Create database directory for SQLite (outside webroot)
RUN mkdir -p /var/drupal-db && chown www-data:www-data /var/drupal-db && chmod 770 /var/drupal-db

# Copy init script
COPY init.sh /usr/local/bin/init.sh
RUN chmod +x /usr/local/bin/init.sh

EXPOSE 80

CMD ["/usr/local/bin/init.sh"]
