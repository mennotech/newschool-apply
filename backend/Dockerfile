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

# local-dev helper: Stripe CLI for webhook testing.
# Set STRIPE_CLI_VERSION at build time if needed.
ARG STRIPE_CLI_VERSION=1.40.8

RUN apt-get update && apt-get install -y \
    gettext-base \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

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

# Copy custom modules.
COPY modules/custom/ /var/www/html/web/modules/custom/

# Copy services.yml template (env vars substituted at container startup via init.sh)
COPY services.yml /var/www/html/services.yml.template

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

