# NewSchool Apply

A web application for prospective students and families to apply to a school.

## Overview

NewSchool Apply is a React-based frontend that guides applicants through the school application process. Drupal serves as the backend, handling all authentication, authorization, business rules, and data storage.

## Architecture

- **Frontend**: Plain React — renders UI, collects input, calls API endpoints
- **Backend**: Drupal — single source of truth for all application logic, permissions, and workflow state

## Features

- Login via Google, Microsoft, or email and password
- Multi-step application form
- Family and student profile management
- Document and information submission
- Application status tracking

## Getting Started

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm start
```

## Notes

- All authentication is handled by Drupal. The frontend never manages tokens or sessions directly.
- Client-side validation is for user experience only. All authoritative validation is server-side.
- See [AGENTS.md](AGENTS.md) for AI coding agent rules and architectural guardrails.
