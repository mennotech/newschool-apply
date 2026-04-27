# Deployment

## Status

This document is a deployment design and implementation guide for a future Fly.io rollout. It describes the target backup and restore architecture for the Drupal 10 backend in this repository. It does not imply that the backup webhook, Restic scripts, or Fly.io wiring are already implemented.

## Goal

Implement a Restic-based backup system for the Drupal backend running on Fly.io with these requirements:

- Back up the SQLite database and Drupal files storage only.
- Do not back up the application codebase.
- Store the Git commit hash as the primary backup identifier.
- Store the release tag or version as secondary metadata when available.
- Expose a secure webhook inside Drupal that triggers a backup.
- Use environment variables for S3 credentials, restore snapshot selection, and Git metadata.
- Make restore operations backup-commit-aware: identify the snapshot by the Git commit recorded at backup time, restore that data set, and run application upgrades if the current runtime commit differs from the backup commit.

## Scope

This deployment design applies to the backend only.

- Target platform: Fly.io
- Runtime: Drupal 10 in Docker
- Database: SQLite
- Mutable application data:
  - SQLite database file
  - Drupal public files directory
- Immutable application data:
  - Git-tracked repository contents
  - Container image contents

The codebase is intentionally excluded from Restic backups because source control and image builds remain the source of truth for application code.

## Backup Principles

1. Drupal remains the application authority, but backup orchestration should be implemented as an operational concern in the backend runtime.
2. The backup payload must contain only mutable runtime data.
3. The backup identifier must be anchored to the exact Git commit deployed.
4. Restore must always know which Git commit produced the backup, even if the restore target runs a newer code revision.
5. Backups must be externally triggerable without requiring shell access to the Fly machine.
6. If the restore runtime commit differs from the backup commit, the restore process must run the required Drupal upgrade steps before returning the application to service.

## Recommended Fly.io Data Layout

The backup design is simplest and safest if all mutable Drupal data lives on a Fly volume mounted at `/data`.

Recommended target layout:

```text
/data/
  sqlite/
    db.sqlite
  files/
    ... Drupal public files ...
```

Recommended Drupal runtime mapping:

- SQLite database path: `/data/sqlite/db.sqlite`
- Drupal files path source: `/data/files`
- Drupal public files path exposed to Drupal: `/var/www/html/web/sites/default/files`

Implementation options for the files directory:

- Preferred: symlink `/var/www/html/web/sites/default/files` to `/data/files`
- Acceptable: bind or copy-on-start pattern if the image/runtime arrangement requires it

If the final build uses different paths, update this document and keep the same design constraints: one persistent location for SQLite and one persistent location for uploaded files.

## What Must Be Backed Up

Include:

- A consistent SQLite snapshot file
- The full Drupal `sites/default/files` content
- A small metadata manifest generated at backup time

Exclude:

- The Git working tree
- Drupal core and contributed code
- Frontend code
- Composer caches, npm caches, temp directories, logs, and container-layer artifacts

## Backup Metadata Model

Restic does not provide a rich first-class description field for snapshot narratives, so the implementation should use both Restic tags and an included manifest file.

### Primary identifier

- `commit:<full_git_sha>`

### Secondary identifiers

- `tag:<git_tag>` when a release tag exists
- `version:<app_version>` when a release version exists

### Required manifest fields

Each backup should generate a small JSON manifest and include it in the snapshot payload, for example `backup-manifest.json`:

```json
{
  "app": "newschool-apply-backend",
  "created_at_utc": "2026-04-27T00:00:00Z",
  "git_commit": "<full_sha>",
  "git_tag": "<tag_or_empty>",
  "app_version": "<version_or_empty>",
  "fly_app": "<fly_app_name>",
  "fly_region": "<fly_region>",
  "backup_source": "drupal-webhook",
  "db_path": "/data/sqlite/db.sqlite",
  "files_path": "/data/files"
}
```

The commit hash is the canonical restore key. The tag and version are helpful for operators, but must not replace the commit hash as the primary selector.

## Environment Variables

Use a `.env` file for local documentation parity and non-production operator workflows, but do not commit secrets. In Fly.io, the same variable names should be injected through Fly secrets or runtime environment configuration.

Example `.env` shape:

```dotenv
# Restic repository
RESTIC_REPOSITORY=s3:https://s3.example.com/newschool-apply-backups
RESTIC_PASSWORD=<restic_repository_password>

# S3 credentials
AWS_ACCESS_KEY_ID=<access_key>
AWS_SECRET_ACCESS_KEY=<secret_key>
AWS_DEFAULT_REGION=<region>

# Drupal data locations
DRUPAL_SQLITE_PATH=/data/sqlite/db.sqlite
DRUPAL_FILES_PATH=/data/files

# Backup webhook security
BACKUP_WEBHOOK_SECRET=<long_random_secret>

# Git deployment metadata
GIT_COMMIT_SHA=<full_git_sha>
GIT_TAG=<release_tag_optional>
APP_VERSION=<version_optional>

# Restore selectors
RESTORE_COMMIT_SHA=<full_git_sha_to_restore>
RESTORE_SNAPSHOT_ID=<restic_snapshot_id_optional>

# Runtime metadata for the code receiving the restore
RUNTIME_GIT_COMMIT_SHA=<full_git_sha_currently_deployed>
```

### Variable responsibilities

- `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, and AWS credentials authenticate backup storage.
- `DRUPAL_SQLITE_PATH` and `DRUPAL_FILES_PATH` tell the scripts what mutable data to protect.
- `BACKUP_WEBHOOK_SECRET` authenticates the Drupal webhook trigger.
- `GIT_COMMIT_SHA` is the required deployment identity and primary backup tag.
- `GIT_TAG` and `APP_VERSION` are optional secondary descriptors.
- `RESTORE_COMMIT_SHA` is the primary restore selector.
- `RESTORE_SNAPSHOT_ID` is an optional override, but it must still be verified against the requested commit hash before restore proceeds.
- `RUNTIME_GIT_COMMIT_SHA` identifies the code revision currently deployed in the runtime and determines whether post-restore upgrades are required.

## Components To Implement

The implementation should be split into three layers.

### 1. Drupal webhook endpoint

Implement a small custom backend module that exposes a protected route such as:

- `POST /api/ops/backups/restic`

The Drupal endpoint should:

- accept `POST` only
- require HTTPS
- validate a shared secret header such as `X-Backup-Token`
- optionally enforce an IP allowlist if an external scheduler has stable egress IPs
- log an audit event with timestamp, source, and requested commit metadata
- invoke a local backup wrapper script or queue worker
- return `202 Accepted` for asynchronous execution

The endpoint should not expose backup secrets in the response body.

### 2. Backup wrapper script

Recommended location:

- `backend/scripts/restic-backup.sh`

Responsibilities:

- validate required environment variables
- create a temporary working directory
- produce a SQLite-consistent backup copy
- generate the backup manifest JSON
- run Restic with commit and release tags
- prune temporary files
- emit structured logs for operators

### 3. Restore wrapper script

Recommended location:

- `backend/scripts/restic-restore.sh`

Responsibilities:

- validate restore inputs
- inspect backup metadata and compare it with the currently deployed runtime commit
- locate the correct Restic snapshot for that commit
- restore into a staging directory first
- replace SQLite and files atomically or with controlled downtime
- run required Drupal upgrade steps when the runtime commit differs from the backup commit
- clear Drupal caches after restore

## Backup Flow

### Step 1. Trigger

An external scheduler or CI/CD pipeline calls the Drupal webhook after a successful deployment or on a schedule.

Recommended callers:

- GitHub Actions workflow on deploy success
- Scheduled CI job
- External cron service

### Step 2. Validate request in Drupal

Drupal validates:

- `X-Backup-Token`
- request method
- any optional caller allowlist rules

If validation fails, return `401` or `403`.

### Step 3. Create a SQLite-safe snapshot copy

Do not back up the live SQLite file by plain file copy while Drupal is writing to it.

Use SQLite's native backup mechanism, for example:

```bash
sqlite3 "$DRUPAL_SQLITE_PATH" ".backup '/tmp/restic-backup/db.sqlite'"
```

This produces a transactionally consistent SQLite snapshot for Restic to upload.

### Step 4. Generate backup manifest

Create `backup-manifest.json` in the temporary backup directory using the deployed environment metadata:

- `GIT_COMMIT_SHA`
- `GIT_TAG`
- `APP_VERSION`
- Fly app and region details if available

### Step 5. Execute Restic backup

Back up:

- the temporary SQLite snapshot copy
- the Drupal files directory
- the generated manifest file

Example command shape:

```bash
restic backup \
  /tmp/restic-backup/db.sqlite \
  "$DRUPAL_FILES_PATH" \
  /tmp/restic-backup/backup-manifest.json \
  --tag "commit:${GIT_COMMIT_SHA}" \
  --tag "source:drupal" \
  ${GIT_TAG:+--tag "tag:${GIT_TAG}"} \
  ${APP_VERSION:+--tag "version:${APP_VERSION}"}
```

### Step 6. Apply retention policy

After backup completes, apply Restic retention rules. A reasonable starting point:

- keep hourly backups for 24 hours
- keep daily backups for 14 days
- keep weekly backups for 8 weeks
- keep monthly backups for 12 months

Example shape:

```bash
restic forget --prune \
  --keep-hourly 24 \
  --keep-daily 14 \
  --keep-weekly 8 \
  --keep-monthly 12
```

Retention should be reviewed against storage budget and compliance requirements.

## Restore Strategy

Restore must be backup-commit-aware.

### Selection precedence

1. `RESTORE_COMMIT_SHA` is required.
2. If `RESTORE_SNAPSHOT_ID` is set, verify it belongs to the same commit before using it.
3. If `RESTORE_SNAPSHOT_ID` is not set, resolve the latest snapshot tagged `commit:<RESTORE_COMMIT_SHA>`.
4. Use `GIT_TAG` or `APP_VERSION` only as operator hints, not as the primary selector.

### Restore workflow

#### 1. Resolve the backup commit and runtime commit

Before any data replacement, determine both identities:

1. the backup commit recorded on the snapshot, selected by `RESTORE_COMMIT_SHA`
2. the currently deployed runtime commit, exposed as `RUNTIME_GIT_COMMIT_SHA`

This gives two valid restore modes:

1. same-commit restore: `RUNTIME_GIT_COMMIT_SHA == RESTORE_COMMIT_SHA`
2. upgrade restore: `RUNTIME_GIT_COMMIT_SHA` represents a newer runtime than `RESTORE_COMMIT_SHA`

The backup commit remains the canonical selector for finding the correct snapshot. The runtime commit decides whether upgrade work must happen after data restore.

Important: commit hashes provide identity, not ordering. The restore process must determine whether the runtime is actually newer by using deployment lineage, release metadata, or Git history available to the restore job. It must not assume lexical ordering or simple inequality is enough to classify an upgrade versus a downgrade.

In Fly.io, the normal operational model should be:

1. deploy the code version you want to run after restore
2. restore the data snapshot identified by `RESTORE_COMMIT_SHA`
3. if the deployed runtime is newer than the backup commit, run the Drupal upgrade path before reopening the app

Downgrade restores are higher risk. Restoring data produced by a newer code revision into an older runtime should be treated as unsupported unless maintainers explicitly validate that downgrade path.

#### 2. Put the app into maintenance mode

Before replacing data:

- stop writes to the SQLite database
- enable Drupal maintenance mode or take the instance out of rotation

#### 3. Resolve the matching Restic snapshot

Example lookup shape:

```bash
restic snapshots --json
```

Filter snapshots for the tag:

- `commit:<RESTORE_COMMIT_SHA>`

If `RESTORE_SNAPSHOT_ID` is supplied, inspect that snapshot and confirm the manifest or tags match the requested commit. Abort if they do not match.

#### 4. Restore to a staging directory

Do not restore directly over live paths first.

Example shape:

```bash
restic restore <snapshot_id> --target /tmp/restic-restore
```

Expected staging outputs:

- restored SQLite copy
- restored files tree
- restored `backup-manifest.json`

#### 5. Replace data

Recommended order:

1. verify restored manifest commit matches `RESTORE_COMMIT_SHA`
2. back up current live data one more time if possible
3. replace the SQLite file with the restored copy
4. synchronize the files directory from the restore target
5. repair ownership and permissions

For files synchronization, prefer `rsync` semantics over destructive raw moves when possible.

#### 6. Run upgrade path when required

After the data is in place, compare:

- backup commit from the restored manifest
- `RUNTIME_GIT_COMMIT_SHA`

If they differ and the runtime is newer than the backup commit, treat the restored data as older application data being opened by newer code. In that case, run the application upgrade path before serving traffic.

Recommended post-restore upgrade actions:

```bash
/var/www/html/vendor/bin/drush updb -y
/var/www/html/vendor/bin/drush cim -y
/var/www/html/vendor/bin/drush cr -y
```

If the current runtime commit matches the backup commit, the upgrade phase can be skipped and cache rebuild is usually sufficient.

#### 7. Recover Drupal runtime

After data is restored:

- clear Drupal caches
- verify the site boots cleanly
- disable maintenance mode

Typical post-restore actions:

```bash
/var/www/html/vendor/bin/drush cr -y
```

If the runtime commit differs from the backup commit, upgrade steps are mandatory before the site returns to service. If the restore target is an older runtime than the backup commit, abort unless a downgrade runbook has been explicitly approved and tested.

## Webhook Security Requirements

Minimum requirements:

- `POST` only
- shared secret header validated against `BACKUP_WEBHOOK_SECRET`
- no query-string secrets
- audit logging without leaking secrets
- rate limiting or replay protection if practical
- HTTPS only

Recommended header contract:

```text
POST /api/ops/backups/restic
X-Backup-Token: <secret>
Content-Type: application/json
```

Optional request body:

```json
{
  "reason": "post-deploy",
  "requested_by": "github-actions",
  "git_commit": "<full_sha>",
  "git_tag": "<optional_tag>",
  "app_version": "<optional_version>"
}
```

Drupal should treat request body metadata as informational only. The server-side environment remains the trusted source for deployed commit identity.

## CI/CD Integration

Recommended sequence for deployment automation:

1. Build and deploy the backend image for a specific Git commit.
2. Inject `GIT_COMMIT_SHA`, `GIT_TAG`, `APP_VERSION`, and `RUNTIME_GIT_COMMIT_SHA` into the running environment.
3. Wait for health checks to pass.
4. Call the Drupal backup webhook.
5. Record the returned operation ID or success status in CI logs.

The CI/CD pipeline should always inject `RUNTIME_GIT_COMMIT_SHA` into the deployed runtime so backup and restore scripts can read the runtime identity directly from the environment without operator input.

Recommended sequence for restore automation:

1. Deploy the code revision that should receive the restored data.
2. Ensure `RUNTIME_GIT_COMMIT_SHA` is present in that deployed runtime.
3. Set `RESTORE_COMMIT_SHA` to the commit hash recorded on the desired backup.
4. Restore the snapshot selected by that backup commit.
5. Run Drupal upgrades if the runtime commit differs from the backup commit.
6. Verify health checks before reopening traffic.

Recommended backup triggers:

- after each successful production deploy
- nightly scheduled backup
- before risky maintenance operations

## Fly.io Operational Notes

- The backup process must run on the machine that has the mounted Fly volume containing SQLite and files.
- If the backend is ever scaled beyond one machine, ensure the webhook is routed to the primary writable instance or use leader-only execution logic.
- Do not run Restic from a stateless external job unless that job has direct access to the same mounted volume contents.
- Keep Restic credentials in Fly secrets, not in the image.

## Failure Handling

The implementation should fail safely.

Abort the backup if:

- `GIT_COMMIT_SHA` is missing
- Restic repository auth fails
- SQLite snapshot creation fails
- the files path is missing or unreadable

Abort the restore if:

- `RESTORE_COMMIT_SHA` is missing
- `RESTORE_SNAPSHOT_ID` does not match the requested commit
- no snapshot can be found for the requested commit
- the manifest commit does not match the requested commit
- `RUNTIME_GIT_COMMIT_SHA` is missing
- the restore would require an unsupported downgrade from newer backup data into older code

Every failure path should return a clear operator-facing error and preserve the current live data.

## Observability

The backup and restore scripts should log:

- timestamp
- operation type
- backup commit SHA
- runtime commit SHA
- tag or version if present
- resolved snapshot ID
- whether upgrade steps were required
- result status
- duration

Do not log:

- S3 secrets
- Restic password
- webhook secret

## Suggested File Placement

When implementation begins, use a layout close to this:

```text
backend/
  scripts/
    restic-backup.sh
    restic-restore.sh
  modules/custom/
    newschool_ops/
      newschool_ops.info.yml
      newschool_ops.routing.yml
      src/Controller/BackupWebhookController.php
```

This keeps Drupal request validation in Drupal and operational shell work in backend scripts.

## Acceptance Criteria

The deployment design should be considered correctly implemented when all of the following are true:

- A `POST` request to the protected Drupal webhook can trigger a Restic backup.
- The backup contains only the SQLite snapshot, Drupal files, and backup manifest.
- Every snapshot is tagged with `commit:<sha>`.
- Snapshots also include tag and version metadata when available.
- A restore can locate the correct snapshot by commit hash without requiring a human to know the snapshot ID.
- If a snapshot ID is supplied, the restore process verifies it matches the requested commit.
- The restore process records both the backup commit and the runtime commit.
- If the runtime commit differs from the backup commit, the restore process runs Drupal upgrades before reopening traffic.
- Unsupported downgrade restores are rejected explicitly.
- Restore leaves the system in a bootable Drupal state with caches cleared.

## Operator Runbooks

### Trigger a backup

```bash
curl -X POST "https://<drupal-host>/api/ops/backups/restic" \
  -H "X-Backup-Token: <secret>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"scheduled-backup","requested_by":"cron"}'
```

### Restore by commit hash

```bash
export RESTORE_COMMIT_SHA=<full_git_sha>
export RESTORE_SNAPSHOT_ID=
export RUNTIME_GIT_COMMIT_SHA=<full_git_sha_currently_deployed>
./backend/scripts/restic-restore.sh
```

### Restore by explicit snapshot with commit verification

```bash
export RESTORE_COMMIT_SHA=<full_git_sha>
export RESTORE_SNAPSHOT_ID=<snapshot_id>
export RUNTIME_GIT_COMMIT_SHA=<full_git_sha_currently_deployed>
./backend/scripts/restic-restore.sh
```

## Open Implementation Decisions

These choices should be finalized before coding starts:

- exact Fly volume mount path if it differs from `/data`
- whether the webhook invokes the backup synchronously or enqueues it
- whether caller IP allowlisting is feasible in the production environment
- whether backup retention must satisfy a formal compliance policy beyond the proposed defaults
- whether the restore process runs inside the app container or in a dedicated admin task container
