# NewSchool Apply

NewSchool Apply is an admissions platform built around a Drupal backend. The documentation in this repository defines the intended system and serves as the implementation plan for building the code. This README is intentionally brief and points to the project documents that describe the target behavior, architecture, and build order.

## Documentation Map

- [AGENTS.md](AGENTS.md): architecture guardrails and repository rules
- [BUILD-STAGES.md](BUILD-STAGES.md): staged implementation order for building the system
- [DEVELOPMENT.md](DEVELOPMENT.md): local development workflow and validation commands
- [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md): target frontend behavior and route inventory
- [BACKEND-FEATURES.md](BACKEND-FEATURES.md): target backend runtime, schema, and API behavior
- [BACKEND-TESTING.md](BACKEND-TESTING.md): target backend PHPUnit and smoke-test guidance
- [DEPLOYMENT.md](DEPLOYMENT.md): deployment notes
- [CHANGELOG.md](CHANGELOG.md): release-visible changes

## Repository Structure

```
/frontend/    JavaScript frontend workspace
/backend/     Drupal container, config, schema, and scripts
```

## Working Rule

Drupal is the system of record for authentication, authorization, workflow, validation, and business logic. The frontend is the UI client for Drupal APIs.

Implementation rule: document first, then build. Follow the staged build order in [BUILD-STAGES.md](BUILD-STAGES.md) when implementing the system.
