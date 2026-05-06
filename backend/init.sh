#!/bin/bash
set -e

# =============================================================================
# NewSchool Apply — Drupal backend initialization script
# Runs once at container startup before Apache is started.
# =============================================================================

DRUPAL_ROOT="/var/www/html/web"
DRUPAL_VENDOR="/var/www/html/vendor"
DRUSH="${DRUPAL_VENDOR}/bin/drush"
CONFIG_SYNC_DIR="/var/www/html/config/sync"
SETTINGS_PHP="${DRUPAL_ROOT}/sites/default/settings.php"
FILES_DIR="${DRUPAL_ROOT}/sites/default/files"
DB_HASH_FILE="/var/drupal-db/.config_hash"
SQLITE_PATH="${DRUPAL_SQLITE_PATH:-/var/drupal-db/db.sqlite}"

ADMIN_USER="${DRUPAL_ADMIN_USER:-admin}"
ADMIN_PASS="${DRUPAL_ADMIN_PASS:-}"
SITE_NAME="${DRUPAL_SITE_NAME:-NewSchool Apply}"
BACKEND_PUBLIC_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_PUBLIC_URL="${FRONTEND_URL:-http://localhost:3000}"
CORS_ORIGINS="${CORS_ALLOWED_ORIGINS:-}"
TRUSTED_HOST_SETTINGS="${DRUPAL_ROOT}/sites/default/trusted-hosts.settings.php"

normalize_hostname() {
  local raw_host="$1"

  raw_host="${raw_host#http://}"
  raw_host="${raw_host#https://}"
  raw_host="${raw_host%%/*}"
  raw_host="${raw_host%%\?*}"
  raw_host="${raw_host%%\#*}"
  raw_host="${raw_host%%:*}"

  if [ -z "${raw_host}" ]; then
    raw_host="localhost"
  fi

  printf '%s' "${raw_host}"
}

normalize_origin() {
  local raw_url="$1"
  local default_origin="$2"
  local scheme="http"

  if [ -z "${raw_url}" ]; then
    printf '%s' "${default_origin}"
    return
  fi

  if [[ "${raw_url}" == http://* ]]; then
    scheme="http"
    raw_url="${raw_url#http://}"
  elif [[ "${raw_url}" == https://* ]]; then
    scheme="https"
    raw_url="${raw_url#https://}"
  fi

  raw_url="${raw_url%%/*}"
  raw_url="${raw_url%%\?*}"
  raw_url="${raw_url%%\#*}"

  if [ -z "${raw_url}" ]; then
    printf '%s' "${default_origin}"
    return
  fi

  printf '%s://%s' "${scheme}" "${raw_url}"
}

escape_regex() {
  printf '%s' "$1" | sed -e 's/[][\\/.^$*+?(){}|]/\\&/g'
}

DEFAULT_CORS_ORIGIN="$(normalize_origin "${FRONTEND_PUBLIC_URL}" "http://localhost:3000")"

if [ -n "${FLY_APP_NAME:-}" ] && [ -n "${CORS_ORIGINS}" ]; then
  echo "[init] Using production CORS override from CORS_ALLOWED_ORIGINS"
else
  if [ -n "${CORS_ORIGINS}" ] && [ -z "${FLY_APP_NAME:-}" ]; then
    echo "[init] Ignoring CORS_ALLOWED_ORIGINS outside production; using FRONTEND_URL instead"
  fi
  CORS_ORIGINS="${DEFAULT_CORS_ORIGIN}"
fi

# -------------------------------------------------------------------------
# 0. Set Apache ServerName to suppress the AH00558 startup warning.
#    Prefer the canonical BACKEND_URL, while still accepting the legacy
#    DRUPAL_HOSTNAME override for environments that need it.
# -------------------------------------------------------------------------
APACHE_SERVER_NAME="$(normalize_hostname "${DRUPAL_HOSTNAME:-${BACKEND_PUBLIC_URL}}")"
echo "ServerName ${APACHE_SERVER_NAME}" > /etc/apache2/conf-available/servername.conf
a2enconf servername > /dev/null 2>&1

echo "[init] Starting NewSchool Apply backend initialization..."

# -------------------------------------------------------------------------
# 1. Set up the Drupal files directory
# -------------------------------------------------------------------------
# On Fly.io, sites/default/files must be a symlink to /data/files.
# On local Docker Compose, it is a real directory backed by a named volume.
if [ -n "${FLY_APP_NAME:-}" ]; then
  echo "[init] Fly.io environment detected; symlinking files to /data/files"
  if [ ! -L "${FILES_DIR}" ]; then
    mkdir -p /data/files
    rm -rf "${FILES_DIR}"
    ln -s /data/files "${FILES_DIR}"
  fi
  chown -h www-data:www-data "${FILES_DIR}"
  chown -R www-data:www-data /data/files
  chmod 770 /data/files
else
  echo "[init] Local environment; ensuring files directory exists"
  mkdir -p "${FILES_DIR}"
  chown -R www-data:www-data "${FILES_DIR}"
  chmod 770 "${FILES_DIR}"
fi

# -------------------------------------------------------------------------
# 2. Generate services.yml from template (inject CORS origins)
# -------------------------------------------------------------------------
SERVICES_DEST="${DRUPAL_ROOT}/sites/default/services.yml"
echo "[init] Generating services.yml..."
# Write the static part of services.yml up to allowedOrigins
cat > "${SERVICES_DEST}" << 'SVCEOF'
parameters:
  session.storage.options:
    gc_probability: 1
    gc_divisor: 100
    gc_maxlifetime: 200000
    cookie_lifetime: 2000000

  cors.config:
    enabled: true
    allowedHeaders:
      - '*'
    allowedMethods:
      - 'GET'
      - 'POST'
      - 'PATCH'
      - 'PUT'
      - 'DELETE'
      - 'OPTIONS'
    allowedOrigins:
SVCEOF
# Append each CORS origin as a YAML list entry
IFS=',' read -ra ORIGINS <<< "${CORS_ORIGINS}"
for origin in "${ORIGINS[@]}"; do
  trimmed=$(echo "$origin" | xargs)
  printf "      - '%s'\n" "${trimmed}" >> "${SERVICES_DEST}"
done
# Append the rest of the CORS config
cat >> "${SERVICES_DEST}" << 'SVCEOF'
    allowedOriginsPatterns: []
    exposedHeaders: false
    maxAge: false
    supportsCredentials: true
SVCEOF
chown www-data:www-data "${SERVICES_DEST}"
echo "[init] services.yml written."

# -------------------------------------------------------------------------
# 3. Write settings.php if it does not exist and refresh trusted hosts
# -------------------------------------------------------------------------
if [ ! -f "${SETTINGS_PHP}" ]; then
  echo "[init] Writing settings.php..."

  # Ensure sites/default is writable temporarily.
  chmod u+w "${DRUPAL_ROOT}/sites/default" 2>/dev/null || true

  HASH_SALT=$(head -c 55 /dev/urandom | base64 | tr -d '+/=' | head -c 55)

  cat > "${SETTINGS_PHP}" <<SETTINGSEOF
<?php

// NewSchool Apply -- generated settings.php
\$databases['default']['default'] = [
  'driver'   => 'sqlite',
  'database' => '${SQLITE_PATH}',
  'prefix'   => '',
];

\$settings['config_sync_directory'] = '/var/www/html/config/sync';
\$settings['hash_salt'] = '${HASH_SALT}';
\$settings['update_free_access'] = FALSE;
\$settings['container_yamls'][] = DRUPAL_ROOT . '/sites/default/services.yml';
\$settings['file_scan_ignore_directories'] = [
  'node_modules',
  'bower_components',
];
\$settings['entity_update_batch_size'] = 50;

if (file_exists(DRUPAL_ROOT . '/sites/default/trusted-hosts.settings.php')) {
  include DRUPAL_ROOT . '/sites/default/trusted-hosts.settings.php';
}
SETTINGSEOF

  chown www-data:www-data "${SETTINGS_PHP}"
  chmod 440 "${SETTINGS_PHP}"
  echo "[init] settings.php written and locked (440)."
fi

if ! grep -Fq "trusted-hosts.settings.php" "${SETTINGS_PHP}"; then
  echo "[init] Updating settings.php to include runtime trusted hosts..."
  chmod u+w "${SETTINGS_PHP}" 2>/dev/null || true
  cat >> "${SETTINGS_PHP}" <<'SETTINGSEOF'

if (file_exists(DRUPAL_ROOT . '/sites/default/trusted-hosts.settings.php')) {
  include DRUPAL_ROOT . '/sites/default/trusted-hosts.settings.php';
}
SETTINGSEOF
  chown www-data:www-data "${SETTINGS_PHP}"
  chmod 440 "${SETTINGS_PHP}"
fi

TRUSTED_HOST_NAME="$(normalize_hostname "${DRUPAL_HOSTNAME:-${BACKEND_PUBLIC_URL}}")"
TRUSTED_HOST_REGEX="$(escape_regex "${TRUSTED_HOST_NAME}")"
echo "[init] Writing trusted host patterns for ${TRUSTED_HOST_NAME}..."
cat > "${TRUSTED_HOST_SETTINGS}" <<SETTINGSEOF
<?php

\$settings['trusted_host_patterns'] = [
  '^localhost(:\\d+)?$',
  '^127\\.0\\.0\\.1(:\\d+)?$',
  '^.*\\.fly\\.dev(:\\d+)?$',
  '^.*\\.fly\\.io(:\\d+)?$',
  '^${TRUSTED_HOST_REGEX}(:\\d+)?$',
];
SETTINGSEOF
chown www-data:www-data "${TRUSTED_HOST_SETTINGS}"
chmod 440 "${TRUSTED_HOST_SETTINGS}"

# -------------------------------------------------------------------------
# 4. Install Drupal if the SQLite database does not yet have the schema
# -------------------------------------------------------------------------
echo "[init] Checking if Drupal is installed..."
DB_READY=false
if [ -f "${SQLITE_PATH}" ]; then
  TABLE_COUNT=$(sqlite3 "${SQLITE_PATH}" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users';" 2>/dev/null || echo "0")
  if [ "${TABLE_COUNT}" = "1" ]; then
    DB_READY=true
  fi
fi

if [ "${DB_READY}" = "false" ]; then
  echo "[init] Drupal not installed. Running site:install..."

  if [ -z "${ADMIN_PASS}" ]; then
    echo "[init] ERROR: DRUPAL_ADMIN_PASS must be set before Drupal can be installed."
    echo "[init] Set DRUPAL_ADMIN_PASS in your .env file and restart the backend."
    exit 1
  fi

  DB_DIR=$(dirname "${SQLITE_PATH}")
  mkdir -p "${DB_DIR}"
  chown -R www-data:www-data "${DB_DIR}"
  chmod 770 "${DB_DIR}"

  # Ensure settings.php is readable by www-data for install.
  chmod 440 "${SETTINGS_PHP}" 2>/dev/null || true

  sudo -u www-data "${DRUSH}" site:install standard \
    --db-url="sqlite:///${SQLITE_PATH}" \
    --account-name="${ADMIN_USER}" \
    --account-pass="${ADMIN_PASS}" \
    --site-name="${SITE_NAME}" \
    --yes \
    2>&1

  echo "[init] Drupal installed."
else
  echo "[init] Drupal is already installed."
fi

# -------------------------------------------------------------------------
# 5. Enable base modules (NOT newschool_payments yet — it has config/install
#    entries that reference content types created in step 6)
# -------------------------------------------------------------------------
echo "[init] Enabling base modules..."
sudo -u www-data "${DRUSH}" pm:enable -y \
  jsonapi \
  serialization \
  basic_auth \
  rest \
  file \
  image \
  datetime \
  options \
  navigation \
  2>&1 || true

# -------------------------------------------------------------------------
# 6. Hash-gated config import (creates node types and field storages)
# -------------------------------------------------------------------------
echo "[init] Checking config hash..."
if [ -d "${CONFIG_SYNC_DIR}" ] && ls "${CONFIG_SYNC_DIR}"/*.yml >/dev/null 2>&1; then
  CURRENT_HASH=$(find "${CONFIG_SYNC_DIR}" -name "*.yml" -exec md5sum {} \; | sort | md5sum | awk '{print $1}')
  STORED_HASH=""
  if [ -f "${DB_HASH_FILE}" ]; then
    STORED_HASH=$(cat "${DB_HASH_FILE}")
  fi

  if [ "${CURRENT_HASH}" != "${STORED_HASH}" ]; then
    echo "[init] Config hash changed. Importing config (partial)..."
    sudo -u www-data "${DRUSH}" config:import --partial --source="${CONFIG_SYNC_DIR}" --yes 2>&1 || true
    echo "${CURRENT_HASH}" > "${DB_HASH_FILE}"
    echo "[init] Config import complete."
  else
    echo "[init] Config hash unchanged; skipping import."
  fi
else
  echo "[init] No config files found; skipping import."
fi

# -------------------------------------------------------------------------
# 6b. Enable newschool_payments (now that content types from config/sync exist)
# -------------------------------------------------------------------------
if [ -d "/var/www/html/web/modules/custom/newschool_payments" ]; then
  echo "[init] Enabling newschool_payments module..."
  sudo -u www-data "${DRUSH}" pm:enable -y newschool_payments 2>&1 || true
else
  echo "[init] newschool_payments module not present; skipping."
fi

# -------------------------------------------------------------------------
# 7. Set JSON:API to write mode
# -------------------------------------------------------------------------
echo "[init] Configuring JSON:API write mode..."
sudo -u www-data "${DRUSH}" cset -y jsonapi.settings read_only 0 2>&1 || true

# -------------------------------------------------------------------------
# 8. Rebuild caches
# -------------------------------------------------------------------------
echo "[init] Rebuilding Drupal caches..."
sudo -u www-data "${DRUSH}" cache:rebuild 2>&1

echo "[init] Initialization complete. Starting Apache..."