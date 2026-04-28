#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# NewSchool Apply — Drupal container initialisation script
# Runs before apache2-foreground on every container start.
# Idempotent: safe to call multiple times.
# ---------------------------------------------------------------------------

DRUSH=/var/www/html/vendor/bin/drush
DRUPAL_ROOT=/var/www/html/web

# Environment defaults
DRUPAL_ADMIN_USER="${DRUPAL_ADMIN_USER:-admin}"
DRUPAL_ADMIN_PASS="${DRUPAL_ADMIN_PASS:-password123}"
DRUPAL_ADMIN_EMAIL="${DRUPAL_ADMIN_EMAIL:-admin@example.com}"
DRUPAL_SQLITE_PATH="${DRUPAL_SQLITE_PATH:-/var/drupal-db/db.sqlite}"
DRUPAL_SITE_NAME="${DRUPAL_SITE_NAME:-NewSchool Apply}"
CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:3000}"

CONFIG_SYNC_DIR=/var/www/html/config/sync
CONFIG_HASH_FILE="$(dirname "${DRUPAL_SQLITE_PATH}")/config_hash"

# ---------------------------------------------------------------------------
# 1. sites/default/files — Fly.io symlink vs. local volume
# ---------------------------------------------------------------------------
SITES_DEFAULT="${DRUPAL_ROOT}/sites/default"
FILES_DIR="${SITES_DEFAULT}/files"

# On Fly.io the /data volume is mounted; create a symlink to /data/files.
if [ -d /data ] && [ ! -L "${FILES_DIR}" ]; then
  mkdir -p /data/files
  chown www-data:www-data /data/files
  chmod 770 /data/files
  # Remove any existing real directory so the symlink can be created.
  rm -rf "${FILES_DIR}"
  ln -s /data/files "${FILES_DIR}"
fi

# Ensure the files directory (real or symlink target) exists with correct ownership.
if [ ! -d "${FILES_DIR}" ]; then
  mkdir -p "${FILES_DIR}"
fi
chown -R www-data:www-data "${FILES_DIR}"
chmod 770 "${FILES_DIR}"

# ---------------------------------------------------------------------------
# 2. settings.php — write once then lock to 440
# ---------------------------------------------------------------------------
SETTINGS_PHP="${SITES_DEFAULT}/settings.php"

if [ ! -f "${SETTINGS_PHP}" ]; then
  echo "[init] Writing settings.php …"

  # Ensure sites/default is writable long enough to drop the file.
  chmod u+w "${SITES_DEFAULT}"

  HASH_SALT="$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1 || true)"
  # Fallback if /dev/urandom is restricted
  [ -z "${HASH_SALT}" ] && HASH_SALT="default-hash-salt-replace-in-production-$(date +%s)"

  cat > "${SETTINGS_PHP}" <<PHP
<?php
\$databases['default']['default'] = array(
  'driver' => 'sqlite',
  'database' => '${DRUPAL_SQLITE_PATH}',
  'prefix' => '',
  'namespace' => 'Drupal\\sqlite\\Driver\\Database\\sqlite',
  'autoload' => 'core/modules/sqlite/src/Driver/Database/sqlite/',
);
\$settings['hash_salt'] = '${HASH_SALT}';
\$settings['config_sync_directory'] = '/var/www/html/config/sync';
\$settings['trusted_host_patterns'] = ['^.*\$'];
\$settings['file_private_path'] = '';
\$settings['file_temp_path'] = '/tmp';
PHP

  chown www-data:www-data "${SETTINGS_PHP}"
  chmod 440 "${SETTINGS_PHP}"
  # Restore sites/default to non-writable
  chmod u-w "${SITES_DEFAULT}"
  echo "[init] settings.php written and locked."
fi

# ---------------------------------------------------------------------------
# 3. services.yml — inject CORS origins from template
# ---------------------------------------------------------------------------
SERVICES_TEMPLATE=/var/www/html/services.yml.template
SERVICES_DEST="${SITES_DEFAULT}/services.yml"

if [ -f "${SERVICES_TEMPLATE}" ]; then
  sed "s|{CORS_ORIGINS}|${CORS_ALLOWED_ORIGINS}|g" "${SERVICES_TEMPLATE}" > "${SERVICES_DEST}"
  chown www-data:www-data "${SERVICES_DEST}"
  echo "[init] services.yml written with CORS origin: ${CORS_ALLOWED_ORIGINS}"
fi

# ---------------------------------------------------------------------------
# 4. Ensure SQLite database directory exists and is writable by www-data
# ---------------------------------------------------------------------------
DB_DIR="$(dirname "${DRUPAL_SQLITE_PATH}")"
if [ ! -d "${DB_DIR}" ]; then
  mkdir -p "${DB_DIR}"
fi
chown -R www-data:www-data "${DB_DIR}"
chmod 770 "${DB_DIR}"

# ---------------------------------------------------------------------------
# 5. Drupal installation (first-time only)
# ---------------------------------------------------------------------------
# Run drush as www-data to respect file-ownership assumptions.
DRUSH_CMD="sudo -u www-data ${DRUSH} --root=${DRUPAL_ROOT}"

drupal_is_installed() {
  local bootstrap
  bootstrap="$(${DRUSH_CMD} status --field=bootstrap 2>/dev/null)"
  [ "${bootstrap}" = "Successful" ]
}

if ! drupal_is_installed; then
  echo "[init] Drupal not yet installed — running site-install …"

  ${DRUSH_CMD} site-install standard \
    --db-url="sqlite://${DRUPAL_SQLITE_PATH}" \
    --site-name="${DRUPAL_SITE_NAME}" \
    --account-name="${DRUPAL_ADMIN_USER}" \
    --account-pass="${DRUPAL_ADMIN_PASS}" \
    --account-mail="${DRUPAL_ADMIN_EMAIL}" \
    --yes

  echo "[init] site-install complete."

  # ------------------------------------------------------------------
  # 5a. Enable required modules
  # ------------------------------------------------------------------
  echo "[init] Enabling required modules …"
  ${DRUSH_CMD} pm:enable -y \
    jsonapi \
    serialization \
    basic_auth \
    rest \
    file \
    image \
    newschool_payments

  # ------------------------------------------------------------------
  # 5b. JSON:API — enable write mode
  # ------------------------------------------------------------------
  ${DRUSH_CMD} config:set jsonapi.settings read_only 0 --yes
  echo "[init] JSON:API write mode enabled."

  # ------------------------------------------------------------------
  # 5c. Create roles
  # ------------------------------------------------------------------
  echo "[init] Creating roles …"
  ${DRUSH_CMD} role:create parent "Parent" || true
  ${DRUSH_CMD} role:create applicant_reviewer "Applicant Reviewer" || true

  echo "[init] Roles created."
fi

# ---------------------------------------------------------------------------
# 6. Hash-gated config import
# ---------------------------------------------------------------------------
if [ -d "${CONFIG_SYNC_DIR}" ] && [ "$(ls -A "${CONFIG_SYNC_DIR}" 2>/dev/null | grep -v '.gitkeep' | wc -l)" -gt 0 ]; then
  # Compute a stable hash of all config YAML content (sorted for determinism).
  CURRENT_HASH="$(find "${CONFIG_SYNC_DIR}" -name '*.yml' | sort | xargs cat 2>/dev/null | md5sum | awk '{print $1}')"

  STORED_HASH=""
  [ -f "${CONFIG_HASH_FILE}" ] && STORED_HASH="$(cat "${CONFIG_HASH_FILE}")"

  if [ "${CURRENT_HASH}" != "${STORED_HASH}" ]; then
    echo "[init] Config hash changed (${STORED_HASH:-none} → ${CURRENT_HASH}). Importing config …"
    ${DRUSH_CMD} config:import --yes || echo "[init] Config import finished (warnings above may be normal on first run)."
    echo "${CURRENT_HASH}" > "${CONFIG_HASH_FILE}"
    echo "[init] Config imported and hash recorded."
  else
    echo "[init] Config hash unchanged — skipping import."
  fi
else
  echo "[init] Config sync directory is empty — skipping config import."
fi

# ---------------------------------------------------------------------------
# 7. Rebuild caches
# ---------------------------------------------------------------------------
echo "[init] Rebuilding Drupal caches …"
${DRUSH_CMD} cache:rebuild
echo "[init] Initialisation complete."