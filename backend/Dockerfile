FROM php:8.3.30-apache-bookworm@sha256:daf3cad5642798e462a029e41d6347cba7f3362f7028f8e60c3623dbadc4e590 AS drupal-base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    sudo \
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
ENV APACHE_DOCUMENT_ROOT=/var/www/html/web

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
    /etc/apache2/sites-available/*.conf \
    /etc/apache2/apache2.conf \
    /etc/apache2/conf-available/*.conf

# Enable Apache modules needed by Drupal/API behavior.
RUN a2enmod rewrite headers

# Prevent browser-native auth prompts on 401 responses so the frontend can
# handle auth/session UX consistently.
RUN printf '%s\n' \
    '<IfModule mod_headers.c>' \
    '  Header always unset WWW-Authenticate' \
    '</IfModule>' \
    > /etc/apache2/conf-available/strip-www-authenticate.conf \
    && a2enconf strip-www-authenticate

# PHP configuration for Drupal
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" && \
    echo "memory_limit = 256M" >> "$PHP_INI_DIR/php.ini" && \
    echo "upload_max_filesize = 32M" >> "$PHP_INI_DIR/php.ini" && \
    echo "post_max_size = 32M" >> "$PHP_INI_DIR/php.ini" && \
    echo "max_execution_time = 300" >> "$PHP_INI_DIR/php.ini" && \
    echo "opcache.enable=1" >> "$PHP_INI_DIR/conf.d/docker-php-ext-opcache.ini" && \
    echo "opcache.memory_consumption=128" >> "$PHP_INI_DIR/conf.d/docker-php-ext-opcache.ini"


WORKDIR /var/www/html

ENV COMPOSER_HOME=/tmp/composer \
    COMPOSER_CACHE_DIR=/tmp/composer/cache

RUN install -d -o www-data -g www-data -m 0770 /tmp/composer /tmp/composer/cache

# Copy composer files
COPY --chown=www-data:www-data composer.json composer.lock ./

# Install Drupal and dependencies
USER www-data
RUN umask 0027; \
    composer install --no-dev --optimize-autoloader --no-interaction 2>&1
USER root

# Add Drush to PATH
RUN ln -s /var/www/html/vendor/bin/drush /usr/local/bin/drush

# File ownership is assigned during COPY and Composer runs as www-data with umask 0027.

# Create database directory for SQLite (outside webroot)
RUN install -d -o www-data -g www-data -m 0770 /var/drupal-db


FROM drupal-base AS backend-customized

# local-dev helper: Stripe CLI for webhook testing.
# Set STRIPE_CLI_VERSION at build time if needed.
ARG STRIPE_CLI_VERSION=1.40.8

# Install Stripe CLI binary (https://github.com/stripe/stripe-cli/releases)
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
        amd64) stripe_arch="x86_64" ;; \
        arm64) stripe_arch="arm64" ;; \
        *) echo "Unsupported architecture for Stripe CLI: $arch"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/stripe/stripe-cli/releases/download/v${STRIPE_CLI_VERSION}/stripe_${STRIPE_CLI_VERSION}_linux_${stripe_arch}.tar.gz" -o /tmp/stripe.tar.gz; \
    tar -xzf /tmp/stripe.tar.gz -C /tmp; \
    mv /tmp/stripe /usr/local/bin/stripe; \
    chmod +x /usr/local/bin/stripe; \
    rm -f /tmp/stripe.tar.gz; \
    stripe --version

# Copy custom modules
COPY --chown=www-data:www-data modules/ web/modules/custom/

# Copy configuration
COPY --chown=www-data:www-data config/ config/

# Copy init script
COPY init.sh /init.sh
RUN chmod +x /init.sh

EXPOSE 80

CMD ["bash", "-c", "/init.sh && apache2-foreground"]
