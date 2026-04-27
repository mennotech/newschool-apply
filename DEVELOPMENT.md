# Development

This document answers the minimum questions a developer or coding agent needs to start work safely and quickly.

## 1. What is the standard local development setup?

- Use Docker for the running application stack.
- Backend always runs in Docker.
- Frontend should normally run in Docker during feature development so local behavior stays close to Fly.io container deployment.
- Install npm locally for fast frontend test runs.
- On Windows, use WSL2 together with Docker Desktop. Do development work from the WSL filesystem view, not from PowerShell against mounted Windows paths when avoidable.

## 2. How do I start the app?

Use the repository root and start both services with Docker Compose.

Example `docker-compose.yml` shape:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8080:80"
    volumes:
      - backend_drupal_db:/var/www/html/web/sites/default/files
    environment:
      - DRUPAL_ADMIN_USER
      - DRUPAL_ADMIN_PASS
      - CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS:-http://localhost:3000}

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - frontend_node_modules:/app/node_modules
    environment:
      - REACT_APP_DRUPAL_BASE_URL=${DRUPAL_BASE_URL:-http://localhost:8080}
    depends_on:
      - backend

volumes:
  backend_drupal_db:
  frontend_node_modules:
```

Typical commands:

```bash
docker compose up --build
docker compose down
docker compose down -v
```

Use `docker compose down -v` only when you intentionally want a fresh Drupal state and a reset SQLite database.

## 3. What is the normal development cycle?

1. Read [AGENTS.md](AGENTS.md), [BACKEND-FEATURES.md](BACKEND-FEATURES.md), and [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md) before changing behavior.
2. Start the stack with Docker Compose.
3. Make the smallest change that matches the documented architecture.
4. Validate the changed area immediately.
5. Update documentation before considering the work complete.

Working rule:

- Drupal decides.
- React displays.
- If logic affects permissions, workflow, validation, or business outcomes, put it in Drupal.

## 4. How should frontend work be done?

- Treat the frontend as a UI client for Drupal APIs.
- Keep the frontend running in Docker for normal development.
- Use local npm inside WSL for fast feedback on tests and frontend-only checks.
- Run frontend commands from `frontend/`, not from the repo root.

Typical frontend validation commands:

```bash
cd frontend
npm test -- --watchAll=false
```

Best practices:

- Use local npm for rapid test cycles.
- Keep API base URLs in environment variables.
- Do not add frontend business logic that duplicates Drupal behavior.
- Do not add dependencies without explicit approval.

## 5. How should backend work be done?

- Backend changes are made and validated through Docker.
- Do not run the backend as a host-local PHP app.
- When backend code, container setup, or Drupal config changes, rebuild and restart the backend container.
- When changing schema-driven structure, regenerate scaffold output if the change depends on `application-form.schema.yaml`.

Typical backend workflow:

```bash
docker compose up --build backend
```

Best practices:

- Keep Drupal config authoritative.
- Prefer reproducible container behavior over machine-specific shortcuts.
- Use SQLite locally unless maintainers explicitly direct otherwise.

## 6. When do I use local npm versus Docker?

Use Docker for running the app.

Use local npm for:

- frontend tests
- fast frontend build or test feedback
- editor-integrated JavaScript workflows

Do not use local npm as a replacement for the backend runtime.

## 7. What must be validated before work is done?

- Run the narrowest check that proves the changed behavior.
- For frontend changes, start with local npm tests in `frontend/`.
- For backend or integration changes, verify behavior against the Dockerized stack.
- If you changed docs only, verify the new instructions match the repository structure and existing guardrails.

Minimum expectation:

- The changed area works.
- The documented commands are still accurate.
- No architecture rule in [AGENTS.md](AGENTS.md) was violated.

## 8. What documentation must stay in sync?

- Update [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md) when frontend behavior changes.
- Update [BACKEND-FEATURES.md](BACKEND-FEATURES.md) when backend behavior, endpoints, schema, or runtime behavior changes.
- Update [README.md](README.md) when setup or high-level project usage changes.
- Update this file when the team changes the development loop.

Documentation is part of the change, not follow-up work.

## 9. What should coding agents do first?

1. Read [AGENTS.md](AGENTS.md).
2. Read the relevant feature inventory document.
3. Work from the smallest concrete file or failing behavior available.
4. Validate immediately after the first meaningful edit.
5. Update docs before stopping.

If a requested change conflicts with the architecture guardrails, stop and escalate instead of working around them.

## 10. How should releases be handled?

Treat each release as a containerized, traceable snapshot of the repository.

Release rules:

- Release from a clean, reviewed commit.
- Make the Git commit SHA the primary release identifier.
- Add a Git tag for human-friendly release tracking when needed.
- Keep release metadata aligned with deployment metadata: `GIT_COMMIT_SHA` is required, while `GIT_TAG` and `APP_VERSION` are optional but recommended.
- Build release artifacts from Docker, not from ad hoc host-local environments.

Recommended release cycle:

1. Confirm the relevant docs are up to date, especially [README.md](README.md), [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md), [BACKEND-FEATURES.md](BACKEND-FEATURES.md), and [DEPLOYMENT.md](DEPLOYMENT.md) when deployment behavior changed.
2. Run the required validation for the release candidate. At minimum, run the frontend test command from `frontend/` and verify the Dockerized stack still starts cleanly.
3. Build the release images from the repository state that will be tagged and deployed.
4. Tag the release commit if the team is using versioned releases.
5. Inject release metadata into the deployment environment so the running containers know which commit and release tag they represent.
6. After deployment, verify the application is healthy before treating the release as complete.

Best practices:

- Do not release from an uncommitted local workspace.
- Do not bypass Docker for backend release validation.
- Keep local development and release images as close as practical so Fly.io behavior matches what was tested.
- If deployment behavior, backup behavior, or restore behavior changes, update [DEPLOYMENT.md](DEPLOYMENT.md) in the same change.
- If a release requires new environment variables, document them before deployment.

Minimum release checklist:

- Docs updated.
- Tests and required validation passed.
- Docker images built from the release commit.
- Release metadata recorded.
- Deployment configuration matches the release.
- Post-deploy health verified.