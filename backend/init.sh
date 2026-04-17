#!/usr/bin/env bash
set -euo pipefail

DRUPAL_ROOT="/var/www/html"
DRUSH="${DRUPAL_ROOT}/vendor/bin/drush"
SITES_DEFAULT="${DRUPAL_ROOT}/web/sites/default"
DB_PATH="${SITES_DEFAULT}/files/.sqlite"
SETTINGS_FILE="${SITES_DEFAULT}/settings.php"

# ── Ensure writable directories ─────────────────────────────────────────────
mkdir -p "${SITES_DEFAULT}/files"
chmod 775 "${SITES_DEFAULT}/files"

# ── Copy default settings if not present ─────────────────────────────────────
if [ ! -f "${SETTINGS_FILE}" ]; then
  cp "${SITES_DEFAULT}/default.settings.php" "${SETTINGS_FILE}"
  chmod 644 "${SETTINGS_FILE}"
fi

# ── Append SQLite database config if not already present ─────────────────────
if ! grep -q "sqlite" "${SETTINGS_FILE}"; then
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

# ── Skip if Drupal is already installed ─────────────────────────────────────
if sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" status bootstrap 2>/dev/null | grep -q "Successful"; then
  echo "[init.sh] Drupal already installed — skipping installation."
else
  echo "[init.sh] Installing Drupal via Drush..."

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
fi

# ── Import configuration ──────────────────────────────────────────────────────
if [ -d "/var/www/html/config/sync" ] && [ "$(ls -A /var/www/html/config/sync)" ]; then
  echo "[init.sh] Importing configuration..."
  sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" config:import --partial --source=/var/www/html/config/sync --yes || true
fi

# ── Enable required modules ───────────────────────────────────────────────────
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

# ── Enable JSON:API writes ────────────────────────────────────────────────────
echo "[init.sh] Enabling JSON:API write mode..."
sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" config:set jsonapi.settings read_only 0 --yes

# Enable social auth modules only if available
sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" pm:enable \
  social_auth \
  social_auth_google \
  social_auth_microsoft \
  --yes 2>/dev/null || echo "[init.sh] Social auth modules not available yet — skipping."

# ── Create roles if they don't exist ─────────────────────────────────────────
echo "[init.sh] Creating roles..."
for ROLE in parent applicant_reviewer; do
  sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" \
    role:create "${ROLE}" 2>/dev/null || echo "[init.sh] Role '${ROLE}' already exists."
done

# ── Clear caches ─────────────────────────────────────────────────────────────
echo "[init.sh] Clearing caches..."
sudo -u www-data "${DRUSH}" --root="${DRUPAL_ROOT}/web" cache:rebuild

echo "[init.sh] Initialization complete."
