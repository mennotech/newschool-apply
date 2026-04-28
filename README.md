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

- The schema in `backend/schema/v2/` uses a split v2 catalog format (one YAML file per reusable or application bundle).
- The scaffold script can also read the legacy monolithic `backend/schema/application-form.schema-v2.yaml` file for compatibility.
- The reusable `application` bundle is limited to cross-form application metadata and shared relationship fields.
- Each concrete application type lives in its own dedicated bundle:
  - `application_partial_programming`
  - `application_full_early_years`
  - `application_full_middle_years`
  - `application_full_senior_years`
- Guardian and emergency contact data is normalized into a reusable `person` bundle.
- Student identity data is normalized into a reusable `student` bundle.
- Postal addresses are normalized into a reusable `address` bundle.

## Contact Record Model

- Guardians are selected by reference rather than by flattened mother/father fields on the application bundle.
- Each `person` record stores identity fields plus typed contact lists.
- Email and phone entries use `type:value` formatting, for example `work:jdoe@contoso.com` or `mobile:2045551234`.
- Person records reference reusable address records instead of embedding postal fields directly.

## Schema Scaffolding

- `backend/scripts/scaffold-drupal-from-schema.js` reads a v2 schema file or a v2 schema directory and generates Drupal scaffold config.
- The scaffold script supports:
  - reusable bundles
  - dedicated application bundles with inherited shared application fields
  - `person_reference`, `address_reference`, and `student_reference` fields
  - multi-value typed contact lists for phone and email storage

## Frontend Direction

- Authenticated users should be able to maintain reusable People and Addresses before or during an application flow.
- Guardian selection should use friendly card-based selection with inline create/edit affordances.
- Application creation should support multiple application types instead of assuming a single admissions form.

## Getting Started

### Backend

Generate Drupal scaffold config from the split v2 schema directory:

```bash
node backend/scripts/scaffold-drupal-from-schema.js backend/schema/v2
```

Or generate from the monolithic compatibility file:

```bash
node backend/scripts/scaffold-drupal-from-schema.js backend/schema/application-form.schema-v2.yaml
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
