FROM php:8.2.28-apache-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    sudo \
    sqlite3 \
    libsqlite3-dev \
    libpng-dev \
    libjpeg-dev \
    libfreetype6-dev \
    libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_sqlite gd zip opcache \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache modules
# mod_rewrite: clean URLs
# mod_headers: strip WWW-Authenticate so browsers don't show a native auth dialog
#   (basic_auth remains functional for API clients; the header is only suppressed
#    in HTTP responses so the browser defers 401 handling to the React frontend)
RUN a2enmod rewrite headers

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Install Drupal 10 via Composer
RUN composer create-project drupal/recommended-project:^10 . --no-interaction --no-progress \
    && composer require \
        drush/drush:^12 \
        drupal/jsonapi_extras:^3 \
        --no-interaction --no-progress

# Copy custom configuration
COPY config/ /var/www/html/config/

# Copy services.yml with CORS settings
COPY services.yml /var/www/html/web/sites/default/services.yml

# Copy initialization script
COPY init.sh /init.sh
RUN chmod +x /init.sh

# Set Apache document root
ENV APACHE_DOCUMENT_ROOT=/var/www/html/web
RUN sed -i 's|/var/www/html|/var/www/html/web|g' /etc/apache2/sites-available/000-default.conf \
    && sed -i 's|/var/www/html|/var/www/html/web|g' /etc/apache2/apache2.conf \
    && sed -i '/<\/VirtualHost>/i\    # Strip WWW-Authenticate so browsers defer 401 handling to the JS frontend\n    Header always unset WWW-Authenticate' /etc/apache2/sites-available/000-default.conf

# Set permissions
# RUN chown -R www-data:www-data /var/www/html \
#    && find /var/www/html -type d -exec chmod 755 {} \; \
#    && find /var/www/html -type f -exec chmod 644 {} \;

RUN chmod +x /init.sh

EXPOSE 80

CMD ["bash", "-c", "/init.sh && apache2-foreground"]
