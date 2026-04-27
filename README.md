# NewSchool Apply

A schema-driven admissions platform built around a Drupal backend and a React frontend.

## Overview

NewSchool Apply is organized so Drupal remains the system of record for workflow, validation, relationships, and persistence, while React renders the parent-facing application experience. The current repository refactor introduces a multi-bundle application catalog, reusable PowerSchool-style contact records, and reusable address records.

## Repository Structure

```
/frontend/    ← Plain React application
/backend/     ← Drupal container, config scaffolding, and initialization scripts
```

## Current Data Model Direction

- The schema in `application-form.schema.yaml` now uses a catalog format.
- The reusable `application` bundle is limited to cross-form application metadata and shared relationship fields.
- Each concrete application type lives in its own dedicated bundle:
  - `application_partial_programming`
  - `application_full_early_years`
  - `application_full_middle_years`
  - `application_full_senior_years`
- Guardian and emergency contact data is normalized into a reusable `person` bundle.
- Postal addresses are normalized into a reusable `address` bundle.

## Contact Record Model

- Guardians are selected by reference rather than by flattened mother/father fields on the application bundle.
- Each `person` record stores identity fields plus typed contact lists.
- Email and phone entries use `type:value` formatting, for example `work:jdoe@contoso.com` or `mobile:2045551234`.
- Person records reference reusable address records instead of embedding postal fields directly.

## Schema Scaffolding

- `backend/scripts/scaffold-drupal-from-schema.js` reads `application-form.schema.yaml` and generates Drupal scaffold config.
- The scaffold script supports:
  - reusable bundles
  - dedicated application bundles with inherited shared application fields
  - `person_reference`, `address_reference`, and `student_profile_reference` fields
  - multi-value typed contact lists for phone and email storage

## Frontend Direction

- Authenticated users should be able to maintain reusable People and Addresses before or during an application flow.
- Guardian selection should use friendly card-based selection with inline create/edit affordances.
- Application creation should support multiple application types instead of assuming a single admissions form.

## Getting Started

### Backend

Generate Drupal scaffold config from the schema:

```bash
node backend/scripts/scaffold-drupal-from-schema.js application-form.schema.yaml
```

### Frontend

Install dependencies and start the development server:

```bash
cd frontend
npm ci
npm start
```

### Tests

Run frontend tests from the frontend package directory:

```bash
cd frontend
npm test -- --watchAll=false
```

## Notes

- Drupal remains authoritative for authentication, authorization, workflow, and validation.
- Client-side validation for typed contact lists and guardian reuse is for UX only; Drupal must validate final record structure.
- SQLite remains the default local backend database.
- See `AGENTS.md`, `FRONTEND-FEATURES.md`, and `BACKEND-FEATURES.md` for project constraints and feature inventory.
