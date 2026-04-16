# NewSchool Apply

A web application for prospective students and families to apply to a school.

## Overview

NewSchool Apply is a monorepo containing the React frontend and the Drupal backend. Drupal handles all authentication, authorization, business rules, and data storage. The React app renders UI and calls Drupal's API.

## Repository Structure

```
/frontend/    ← Plain React application
/backend/     ← Drupal container (Dockerfile, init script, config)
```

## Architecture

- **Frontend** (`/frontend/`): Plain React — renders UI, collects input, calls Drupal API endpoints
- **Backend** (`/backend/`): Drupal — single source of truth for all application logic, permissions, and workflow state. Runs in a Docker container with SQLite by default for lightweight local development and testing.

## Features

- Login via Google, Microsoft, or email and password
- Multi-step application form
- Family and student profile management
- Document and information submission
- Application status tracking

## Getting Started

### Backend (Drupal)

Build and start the Drupal container:

```bash
cd backend
docker build -t newschool-drupal .
docker run -p 8080:80 newschool-drupal
```

Drupal will be available at `http://localhost:8080`. The initialization script runs automatically on first start and seeds Drupal with default configuration using SQLite.

### Frontend (React)

Install dependencies and start the development server:

```bash
cd frontend
npm ci
npm start
```

The React app expects Drupal at the URL configured in `frontend/.env` via `REACT_APP_DRUPAL_BASE_URL`.

### Running Frontend Tests

```bash
cd frontend
npm test -- --watchAll=false
```

## Notes

- All authentication is handled by Drupal. The frontend never manages tokens or sessions directly.
- Client-side validation is for user experience only. All authoritative validation is server-side.
- SQLite is the default database for local development. Production deployments should configure a proper database (e.g., MySQL/PostgreSQL) via environment variables.
- See [AGENTS.md](AGENTS.md) for AI coding agent rules and architectural guardrails.
