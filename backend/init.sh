#!/bin/bash
set -e

DRUPAL_ROOT="/var/www/html/web"
DRUSH="/var/www/html/vendor/bin/drush"
CONFIG_SYNC="/var/www/html/config/sync"
SETTINGS_FILE="${DRUPAL_ROOT}/sites/default/settings.php"
SQLITE_PATH="${DRUPAL_SQLITE_PATH:-/var/drupal-db/db.sqlite}"
HASH_FILE="/var/drupal-db/.config_hash"
ADMIN_USER="${DRUPAL_ADMIN_USER:-admin}"
ADMIN_PASS="${DRUPAL_ADMIN_PASS:-password123}"
SITE_NAME="${DRUPAL_SITE_NAME:-NewSchool Apply}"

echo "[init] Starting NewSchool Apply backend initialization..."

# -----------------------------------------------------------------------
# Set up sites/default/files
# -----------------------------------------------------------------------
# On Fly.io, use a symlink to /data/files; on local Docker Compose use
# a real directory (the named volume is mounted at sites/default/files).
if [ -n "${FLY_APP_NAME}" ]; then
    echo "[init] Fly.io environment detected. Setting up /data symlinks..."
    mkdir -p /data/files /data/db
    if [ ! -L "${DRUPAL_ROOT}/sites/default/files" ]; then
        rm -rf "${DRUPAL_ROOT}/sites/default/files"
        ln -s /data/files "${DRUPAL_ROOT}/sites/default/files"
    fi
    chown -h www-data:www-data "${DRUPAL_ROOT}/sites/default/files"
    chown -R www-data:www-data /data/files
    chmod 770 /data/files
    chown -R www-data:www-data /data/db
    chmod 770 /data/db
else
    echo "[init] Local Docker Compose environment."
    mkdir -p "${DRUPAL_ROOT}/sites/default/files"
    chown www-data:www-data "${DRUPAL_ROOT}/sites/default/files"
    chmod 770 "${DRUPAL_ROOT}/sites/default/files"
fi

# -----------------------------------------------------------------------
# Write services.yml from template (inject CORS origins)
# -----------------------------------------------------------------------
SERVICES_DEST="${DRUPAL_ROOT}/sites/default/services.yml"
if [ -f /var/www/html/services.yml.template ]; then
    CORS_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:3000}"
    # Build proper YAML list entries (one per origin) from comma-separated string
    CORS_YAML=""
    IFS=',' read -ra _ORIGINS <<< "$CORS_ORIGINS"
    for _origin in "${_ORIGINS[@]}"; do
        _origin=$(echo "$_origin" | tr -d '[:space:]')
        [ -n "$_origin" ] && CORS_YAML="${CORS_YAML}    - '${_origin}'"$'\n'
    done
    unset _ORIGINS _origin
    # Replace the placeholder line with one YAML list entry per origin
    while IFS= read -r _line || [ -n "$_line" ]; do
        if echo "$_line" | grep -qF '__CORS_ORIGINS__'; then
            printf '%s' "$CORS_YAML"
        else
            printf '%s\n' "$_line"
        fi
    done < /var/www/html/services.yml.template > "$SERVICES_DEST"
    chown www-data:www-data "$SERVICES_DEST"
    chmod 640 "$SERVICES_DEST"
    echo "[init] services.yml written."
fi

# -----------------------------------------------------------------------
# Write settings.php if missing
# -----------------------------------------------------------------------
if [ ! -f "$SETTINGS_FILE" ]; then
    echo "[init] Writing settings.php..."
    mkdir -p "${DRUPAL_ROOT}/sites/default"
    cat > "$SETTINGS_FILE" << SETTINGSEOF
<?php
\$databases['default']['default'] = [
  'driver' => 'sqlite',
  'database' => '${SQLITE_PATH}',
  'prefix' => '',
];

\$settings['file_public_path'] = 'sites/default/files';
\$settings['file_private_path'] = '';
\$settings['config_sync_directory'] = '/var/www/html/config/sync';

\$settings['hash_salt'] = '$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)';

// Trusted host patterns: prefer TRUSTED_HOST_PATTERNS env var, then derive
// from FLY_APP_NAME for Fly.io production, then fall back to localhost-only.
\$_trusted_env = getenv('TRUSTED_HOST_PATTERNS');
\$_fly_app = getenv('FLY_APP_NAME');
if (\$_trusted_env) {
  \$settings['trusted_host_patterns'] = array_map('trim', explode(',', \$_trusted_env));
} elseif (\$_fly_app) {
  \$settings['trusted_host_patterns'] = ['^' . preg_quote(\$_fly_app, '/') . '\\.fly\\.dev\$'];
  \$_app_hostname = getenv('APP_HOSTNAME');
  if (\$_app_hostname) {
    \$settings['trusted_host_patterns'][] = '^' . preg_quote(\$_app_hostname, '/') . '\$';
  }
  unset(\$_app_hostname);
} else {
  \$settings['trusted_host_patterns'] = ['^localhost\$', '^127\\.0\\.0\\.1\$'];
}
unset(\$_trusted_env, \$_fly_app);
\$settings['update_free_access'] = FALSE;
\$settings['container_yamls'][] = DRUPAL_ROOT . '/sites/default/services.yml';
SETTINGSEOF

    chown www-data:www-data "$SETTINGS_FILE"
    chmod 440 "$SETTINGS_FILE"
    echo "[init] settings.php written."
else
    echo "[init] settings.php already exists, skipping."
fi

# -----------------------------------------------------------------------
# Install Drupal if database doesn't have a valid schema
# -----------------------------------------------------------------------
SQLITE_DB_DIR=$(dirname "$SQLITE_PATH")
mkdir -p "$SQLITE_DB_DIR"
chown www-data:www-data "$SQLITE_DB_DIR"
chmod 770 "$SQLITE_DB_DIR"

DB_EXISTS=0
if [ -f "$SQLITE_PATH" ]; then
    # Check that the DB has a users_field_data table (valid Drupal schema)
    TABLE_COUNT=$(sudo -u www-data sqlite3 "$SQLITE_PATH" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users_field_data';" 2>/dev/null || echo "0")
    if [ "$TABLE_COUNT" -gt "0" ]; then
        DB_EXISTS=1
    fi
fi

if [ "$DB_EXISTS" -eq "0" ]; then
    echo "[init] No valid Drupal database found. Installing Drupal..."

    sudo -u www-data php "$DRUSH" site:install standard \
        --db-url="sqlite://${SQLITE_PATH}" \
        --account-name="${ADMIN_USER}" \
        --account-pass="${ADMIN_PASS}" \
        --site-name="${SITE_NAME}" \
        --yes \
        2>&1

    echo "[init] Enabling required modules..."
    sudo -u www-data php "$DRUSH" pm:enable -y \
        jsonapi \
        serialization \
        basic_auth \
        rest \
        file \
        image \
        newschool_payments \
        2>&1 || true

    echo "[init] Configuring JSON:API write mode..."
    sudo -u www-data php "$DRUSH" config:set jsonapi.settings read_only 0 --yes 2>&1 || true

    echo "[init] Creating roles..."
    sudo -u www-data php "$DRUSH" role:create parent "Parent" --yes 2>&1 || true
    sudo -u www-data php "$DRUSH" role:create applicant_reviewer "Applicant Reviewer" --yes 2>&1 || true

    echo "[init] Drupal installation complete."
fi

# -----------------------------------------------------------------------
# Config import (hash-gated)
# -----------------------------------------------------------------------
if [ -d "$CONFIG_SYNC" ] && [ "$(ls -A "$CONFIG_SYNC" 2>/dev/null)" ]; then
    CURRENT_HASH=$(find "$CONFIG_SYNC" -type f -exec md5sum {} \; | sort | md5sum | awk '{print $1}')
    STORED_HASH=""
    if [ -f "$HASH_FILE" ]; then
        STORED_HASH=$(cat "$HASH_FILE")
    fi

    if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
        echo "[init] Config hash changed (stored: ${STORED_HASH:-none}, current: $CURRENT_HASH). Importing config..."
        sudo -u www-data php "$DRUSH" config:import --yes 2>&1 || echo "[init] Config import completed with warnings."
        echo "$CURRENT_HASH" > "$HASH_FILE"
        echo "[init] Config import complete. Hash updated."
    else
        echo "[init] Config hash unchanged. Skipping import."
    fi
else
    echo "[init] No config sync directory or empty. Skipping config import."
fi

# -----------------------------------------------------------------------
# Rebuild caches
# -----------------------------------------------------------------------
echo "[init] Rebuilding Drupal caches..."
sudo -u www-data php "$DRUSH" cache:rebuild 2>&1 || true

echo "[init] Initialization complete. Starting Apache..."

# Start Apache in foreground
exec apache2-foreground
