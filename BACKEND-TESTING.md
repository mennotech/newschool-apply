# Backend Testing Framework Guide

This document describes the backend testing surface that currently exists in this repository.

Part of: [INIT-PROMPT-FULL.md](INIT-PROMPT-FULL.md#backend-tests-powershell-smoke-tests)

The current backend test layers are:

1. PHPUnit for Drupal unit and kernel tests in `backend/tests/`.
2. PowerShell module-driven validation through `DrX-Schema` for backend auth/session checks, schema CRUD validation, and JSON:API lifecycle validation.

For high-level testing strategy and CI integration, see [INIT-PROMPT-FULL.md](INIT-PROMPT-FULL.md).

## PHPUnit

PHPUnit tests live under `backend/tests/` and follow Drupal testing conventions.

Structure:

```text
backend/
  tests/
    src/
      Unit/          - Pure PHP unit tests
      Kernel/        - Drupal kernel tests
```

Run PHPUnit inside the backend container:

```bash
docker compose exec backend /var/www/html/vendor/bin/phpunit \
  --configuration /var/www/html/phpunit.xml \
  /var/www/html/web/modules/custom
```

Guidance:

- Use Unit tests for isolated PHP logic.
- Use Kernel tests for entity, field, and configuration behavior.
- Do not use PHPUnit for frontend-facing JSON:API contract checks.

## PowerShell Module Validation

The PowerShell backend validation surface is the `DrX-Schema` module at `schema/DrX-Schema/DrX-Schema.psd1`.

Load it from the repo root:

```powershell
pwsh -File Enable-DrX-Schema.ps1
```

After loading the module, the main validation commands are:

- `Invoke-DrXApiSmokeTest`
- `Invoke-DrXDbSchemaValidation`
- `Invoke-DrXInternalApiSchemaValidation`
- `Invoke-DrXExternalApiSchemaValidation`
- `Export-DrXDrupalScaffoldConfig`

Defaults:

- Commands load `.env` from the current directory first, then the repo root.
- Schema commands use `DRX_SCHEMA_PATH` when it is set in the process environment or `.env`, otherwise they default to `schema/v2`.

## Validation Command Roles

### `Invoke-DrXApiSmokeTest`

Purpose: verify authenticated backend session basics and JSON:API index availability.

Use it to answer:

- Can the test user log in successfully?
- Does `/session/token` work?
- Is the JSON:API index reachable for the authenticated session?

### `Invoke-DrXDbSchemaValidation`

Purpose: validate the Drupal entity layer directly.

How it works:

- Uses Drush inside the backend container.
- Creates, reloads, updates, and deletes one temporary node per schema bundle.

Use it to answer:

- Does Drupal itself recognize each schema bundle?
- Can Drupal persist those bundles correctly through the entity API?

### `Invoke-DrXInternalApiSchemaValidation`

Purpose: validate the hybrid internal-create plus external-API path.

How it works:

- Creates temporary fixture nodes through Drush inside the backend container.
- Then validates JSON:API index exposure and authenticated `GET`, `PATCH`, and `DELETE` over HTTP.

Use it to answer:

- Can the API read and mutate real bundle instances once Drupal has already created them internally?

### `Invoke-DrXExternalApiSchemaValidation`

Purpose: validate the pure external-client JSON:API lifecycle.

How it works:

- Creates fixtures only through JSON:API over HTTP.
- Builds payloads from the normalized schema and creates referenced fixtures the same way.
- Then validates authenticated `GET`, `PATCH`, and `DELETE` over HTTP.

Use it to answer:

- Can a real external client perform the full bundle lifecycle through the published API alone?

This command is also useful as a schema/config drift detector. If Drupal requires fields that were added manually in the UI and are not represented in `schema/v2`, this command should fail.

## Interpreting Failures

- If `Invoke-DrXDbSchemaValidation` passes but `Invoke-DrXInternalApiSchemaValidation` fails, Drupal bundle persistence is working internally but JSON:API exposure, permissions, routing, or request handling is broken.
- If `Invoke-DrXInternalApiSchemaValidation` passes but `Invoke-DrXExternalApiSchemaValidation` fails, the API can operate on server-created fixtures but does not yet support a pure external-client create lifecycle for one or more bundles.
- If `Invoke-DrXExternalApiSchemaValidation` reports missing required fields that are not represented in `schema/v2`, the live Drupal config has drifted from the schema source of truth.
- If all three schema validations fail, the underlying schema, generated config, or Drupal bundle setup is usually broken.

## Recommended Local Workflow

From the repository root:

```powershell
docker compose up -d backend
pwsh -File Enable-DrX-Schema.ps1
Invoke-DrXApiSmokeTest
Invoke-DrXDbSchemaValidation
Invoke-DrXInternalApiSchemaValidation
Invoke-DrXExternalApiSchemaValidation
```

Regenerate Drupal scaffold config from schema when needed:

```powershell
pwsh -File Enable-DrX-Schema.ps1
Export-DrXDrupalScaffoldConfig
```

## CI Guidance

In CI, keep the backend validation sequence aligned with local usage:

1. Regenerate Drupal scaffold config from schema with `Export-DrXDrupalScaffoldConfig`.
2. Build the backend image.
3. Start the backend container.
4. Wait for backend health.
5. Load `DrX-Schema` and run the validation commands needed for that pipeline.
6. Print backend logs on failure.
7. Always tear down containers and volumes.

Example workflow fragment:

```yaml
- name: Regenerate Drupal scaffold config
  run: pwsh -NoProfile -Command ". .\\Enable-DrX-Schema.ps1; Export-DrXDrupalScaffoldConfig"

- name: Start backend container
  run: docker compose up -d backend

- name: Run backend validation
  run: pwsh -NoProfile -Command ". .\\Enable-DrX-Schema.ps1; Invoke-DrXApiSmokeTest; Invoke-DrXDbSchemaValidation; Invoke-DrXInternalApiSchemaValidation"
```

Include `Invoke-DrXExternalApiSchemaValidation` in CI when you want strict external-contract enforcement and the live schema/config is expected to be fully aligned.

## Minimum Done Criteria

Backend validation is considered current and usable when:

- Tests run cross-platform using `pwsh`.
- Backend validation runs only against the Dockerized Drupal backend.
- `DrX-Schema` is the documented PowerShell validation surface.
- Schema-derived Drupal config is generated through `Export-DrXDrupalScaffoldConfig`.
- The validation roles of DB, internal API, and external API checks are documented clearly.
- The documented commands match the commands contributors actually run from the repo root.

## Copilot Agent Expectations

When working on backend features, agents should:

1. Consult this document before changing backend tests or validation flow.
2. Load `DrX-Schema` from the repo root with `pwsh -File Enable-DrX-Schema.ps1`.
3. Run the relevant backend validation commands after backend changes.
4. Treat `Invoke-DrXExternalApiSchemaValidation` failures as possible schema/config drift, not just test harness failures.

For Copilot agent responsibilities and repository guardrails, see [AGENTS.md](AGENTS.md).

## 14. Documentation Structure

This document is part of the complete NewSchool Apply documentation system:

- **[INIT-PROMPT-FULL.md](INIT-PROMPT-FULL.md)** — Main initialization prompt with project overview, setup, and high-level testing strategy
- **[AGENTS.md](AGENTS.md)** — Architectural guardrails and AI agent responsibilities (section 13 covers testing)
- **[BACKEND-TESTING.md](BACKEND-TESTING.md)** — This file; detailed backend testing framework reference
- **[BACKEND-FEATURES.md](BACKEND-FEATURES.md)** — Complete backend feature specification
- **[FRONTEND-FEATURES.md](FRONTEND-FEATURES.md)** — Complete frontend feature specification

Read all referenced documents before implementing features or tests.
