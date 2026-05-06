# Build Stages

This repository follows a document -> build workflow. Treat the Markdown docs as the implementation instructions for the codebase, and build the system in stages rather than attempting the full platform at once.

## Stage 1: Backend First

Build and validate the Drupal backend before relying on any frontend implementation.

- Implement the backend runtime, schema, configuration, authentication, JSON:API behavior, and required custom endpoints.
- Use [AGENTS.md](AGENTS.md), [BACKEND-FEATURES.md](BACKEND-FEATURES.md), and [BACKEND-TESTING.md](BACKEND-TESTING.md) as the primary build instructions.
- Run backend validation and smoke tests before moving to the frontend stage.

## Stage 2: Frontend Without Payments

Once the backend foundation is stable, build the frontend UI and application flow without the payment feature.

- Implement routing, authentication UX, dashboard flows, reusable people and addresses, and the multi-step application flow.
- Exclude Stripe checkout, payment polling, and payment success UX in this stage.
- Use [FRONTEND-FEATURES.md](FRONTEND-FEATURES.md) together with the backend docs, but defer payment-specific sections until Stage 3.

## Stage 3: Add Payments

After the backend and non-payment frontend flows are working, add the payment system as a final integration stage.

- Implement the payment backend endpoints, webhook handling, and payment data model.
- Add the frontend payment entry points, success state, and receipt visibility.
- Validate payment behavior only after the non-payment application flow is already working end to end.

## Working Principle

Build in dependency order:

1. Backend system and tests
2. Frontend without payments
3. Payment feature integration

This keeps the system shippable at each phase and reduces architectural drift between the docs and the code.