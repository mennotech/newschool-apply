#!/usr/bin/env bash
set -euo pipefail

DRUPAL_ROOT="/var/www/html"
DRUSH="${DRUPAL_ROOT}/vendor/bin/drush"
SITES_DEFAULT="${DRUPAL_ROOT}/web/sites/default"
DB_PATH="${SITES_DEFAULT}/files/.sqlite"
SETTINGS_FILE="${SITES_DEFAULT}/settings.php"
CONFIG_SYNC_DIR="/var/www/html/config/sync"
CONFIG_HASH_FILE="${SITES_DEFAULT}/files/.config_hash"

is_installed_sqlite() {
  if [ ! -f "${DB_PATH}" ]; then
    return 1
  fi

  # Only treat the DB as installed if a core Drupal table exists.
  sqlite3 "${DB_PATH}" "SELECT name FROM sqlite_master WHERE type='table' AND name='key_value';" 2>/dev/null | grep -q '^key_value$'
}

# ── Substitute environment variables into services.yml ──────────────────────
CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://localhost:3000}"
export CORS_ALLOWED_ORIGINS
envsubst '${CORS_ALLOWED_ORIGINS}' \
  < /var/www/html/services.yml.template \
  > /var/www/html/web/sites/default/services.yml

# ── Ensure writable directories ─────────────────────────────────────────────
mkdir -p "${SITES_DEFAULT}/files"
chmod 775 "${SITES_DEFAULT}/files"

# ── Copy default settings if not present ─────────────────────────────────────
if [ ! -f "${SETTINGS_FILE}" ]; then
  cp "${SITES_DEFAULT}/default.settings.php" "${SETTINGS_FILE}"
  chmod 644 "${SETTINGS_FILE}"
fi

# ── Append SQLite database config if not already present ─────────────────────
if ! grep -Fq "'database' => '/var/www/html/web/sites/default/files/.sqlite'" "${SETTINGS_FILE}"; then
  cat >> "${SETTINGS_FILE}" <<'EOF'

$databases['default']['default'] = [
  'driver'   => 'sqlite',
  'database' => '/var/www/html/web/sites/default/files/.sqlite',
  'prefix'   => '',
];

$settings['hash_salt'] = getenv('DRUPAL_HASH_SALT') ?: 'newschool-apply-default-hash-salt-change-in-prod';
$settings['config_sync_directory'] = '/var/www/html/config/sync';
EOF
fi

chown -R www-data:www-data "${SITES_DEFAULT}"

# ── Function: enable required modules (runs only after a fresh site install) ──
enable_modules() {
  # Delete jsonapi.settings if it was imported before the module was enabled,
  # which causes PreExistingConfigException. The module will recreate it.
  echo "[init.sh] Enabling modules..."
  sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" config:delete jsonapi.settings --yes 2>/dev/null || true
  sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" pm:enable \
    jsonapi \
    serialization \
    basic_auth \
    rest \
    file \
    image \
    --yes || true

  echo "[init.sh] Enabling JSON:API write mode..."
  sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" config:set jsonapi.settings read_only 0 --yes

  sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" pm:enable \
    social_auth \
    social_auth_google \
    social_auth_microsoft \
    --yes 2>/dev/null || echo "[init.sh] Social auth modules not available yet — skipping."

  echo "[init.sh] Creating roles..."
  for ROLE in parent applicant_reviewer; do
    sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" \
      role:create "${ROLE}" 2>/dev/null || echo "[init.sh] Role '${ROLE}' already exists."
  done
}

# ── Function: apply config/sync when its content has changed ─────────────────
apply_config() {
  compute_config_hash() {
    find "${CONFIG_SYNC_DIR}" -type f | sort | xargs md5sum 2>/dev/null | md5sum | awk '{print $1}'
  }

  if [ ! -d "${CONFIG_SYNC_DIR}" ] || [ -z "$(ls -A "${CONFIG_SYNC_DIR}")" ]; then
    echo "[init.sh] No config/sync content found — skipping config import."
    return
  fi

  CURRENT_HASH="$(compute_config_hash)"
  APPLIED_HASH=""
  if [ -f "${CONFIG_HASH_FILE}" ]; then
    APPLIED_HASH="$(cat "${CONFIG_HASH_FILE}")"
  fi

  if [ "${CURRENT_HASH}" = "${APPLIED_HASH}" ]; then
    echo "[init.sh] Config hash unchanged (${CURRENT_HASH}) — skipping config import."
  else
    echo "[init.sh] Config hash changed (applied: ${APPLIED_HASH:-none} → current: ${CURRENT_HASH}) — importing configuration..."
    if sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" config:import --partial --source="${CONFIG_SYNC_DIR}" --yes; then
      echo "${CURRENT_HASH}" > "${CONFIG_HASH_FILE}"
      chown www-data:www-data "${CONFIG_HASH_FILE}"
      echo "[init.sh] Configuration imported and hash recorded."
    else
      echo "[init.sh] Configuration import FAILED — hash not updated, will retry on next startup."
    fi
  fi
}

# ── Install Drupal only if a valid SQLite site database exists ───────────────
if is_installed_sqlite; then
  echo "[init.sh] SQLite database with Drupal schema found — skipping installation."
else
  if [ -f "${DB_PATH}" ]; then
    echo "[init.sh] SQLite file exists but is not initialized for Drupal — reinstalling site..."
    rm -f "${DB_PATH}"
  else
    echo "[init.sh] No SQLite database found — installing Drupal..."
  fi

  ADMIN_USER="${DRUPAL_ADMIN_USER:-admin}"
  ADMIN_PASS="${DRUPAL_ADMIN_PASS:-changeme}"

  sudo -u www-data "${DRUSH}" \
    --root="${DRUPAL_ROOT}/web" \
    site:install standard \
    --db-url="sqlite://${DB_PATH}" \
    --account-name="${ADMIN_USER}" \
    --account-pass="${ADMIN_PASS}" \
    --account-mail="admin@example.com" \
    --site-name="NewSchool Apply" \
    --yes

  echo "[init.sh] Drupal installed successfully."
  enable_modules
fi

apply_config

# ── Clear caches ─────────────────────────────────────────────────────────────
echo "[init.sh] Clearing caches..."
sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" cache:rebuild

echo "[init.sh] Initialization complete."
