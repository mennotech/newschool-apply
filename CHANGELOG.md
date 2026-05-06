# Changelog

This document is the repository source of truth for release-visible changes. Use it together with Git tags and GitHub Releases on github.com.

## Purpose

- Track features and fixes that matter to users, operators, and maintainers.
- Keep release notes consistent across PRs, tags, deployments, and GitHub Releases.
- Provide a reliable audit trail for what changed, when, and why.

## Workflow

1. Add release-visible changes to the `Unreleased` section as part of normal feature or fix work.
2. Before release, review and group entries by impact.
3. Create a new version section from `Unreleased` with date and tag.
4. Create the Git tag from the release commit.
5. Publish a GitHub Release using this document as the release-notes source.
6. Keep deployment metadata aligned (`GIT_COMMIT_SHA`, optional `GIT_TAG`, optional `APP_VERSION`).

## Entry Rules

- Write entries in plain language focused on outcomes, not implementation detail.
- Link PRs and issues when available.
- Mark backward-incompatible behavior under `Breaking Changes`.
- Record security-impacting changes under `Security`.
- If operator action is required, add a short action note.

## GitHub Release Best Practices

- Use an immutable Git tag per release (for example, `v0.4.0`).
- Ensure tag points to a reviewed release commit.
- Include compare link in release notes (`previous_tag...current_tag`).
- Attach deployment-relevant notes: migrations, env vars, rollback hints.
- Do not publish a release until validation and smoke checks pass.

## Template

## Unreleased

### Added
- Full multi-step application wizard (8 steps: Student Info, Health, Guardian Info, Additional Support, Questionnaire, Commitment, Documents, Review).
- Reusable `Person` record picker with inline create used in Steps 2, 3, and 5.
- Reusable `Address` record picker with inline create used in Step 1.
- `TypedContactList` component for collecting `type:value` email and phone entries on person records.
- Guardian relationship-type select on Step 3 (application-level field), replacing relationship field on the person record.
- Signature canvas on Step 6 (Commitment) with clear/re-draw support.
- Document upload step with client-side size/type pre-checks and Drupal-authoritative validation.
- Stripe payment integration: checkout session creation, webhook handling, and payment success polling page.
- Dashboard with application list, status badges, continue/delete/view actions, and payment receipt links.
- Application Detail page showing student summary, document list, and status.
- Profile page with basic account info display.
- Custom Drupal module `newschool_payments` for Stripe checkout and payment record management.
- Backend smoke-test suite under `backend/scripts/smoke/` (PowerShell, cross-platform).
- Redux Toolkit slice (`applicationSlice`) managing application CRUD, people, addresses, and payments.
- Session bootstrapping: if a valid Drupal session exists without frontend auth state, frontend restores user from `/api/session/info`.
- `getLogoutToken()` recovery path for bootstrapped sessions.
- Responsive layout with `clamp()`-based horizontal padding that scales from mobile to wide screen.
- Social login entry points for Google and Microsoft (Drupal-managed, frontend redirect only).

### Changed
- Guardian `relationship_to_student` moved from the `person` record to the application form (Step 3). The person bundle field still exists but is no longer required and is not shown in the frontend person picker.
- `PersonPicker` component no longer collects, displays, or validates a relationship type. The "new person" form asks only for name, workplace, and contacts.
- `createPersonAsync` and `updatePersonAsync` no longer send `field_relationship_to_student` in POST/PATCH bodies.
- Step 3 primary guardian relationship is now a required `<select>` stored in `field_primary_guardian_re_630bb2`; secondary guardian relationship is an optional `<select>` stored in `field_secondary_guardian__d20f5d`.
- `AddressPicker` and `PersonPicker` inner "save" sections converted from `<form>` to `<div>` to prevent nested-form HTML submission of the outer step form.
- Save buttons in pickers are `type="button"` with explicit `onClick` handlers (not `type="submit"`).
- `createApplicationAsync` now includes `_rel_*` relationship fields in the initial POST body, matching the behavior of `updateApplicationAsync`.
- Dashboard `completedSteps.sort()` fixed to copy array before sorting to avoid mutating frozen Redux state.
- Application-level `field_relationship_to_student` field on `person` bundle marked `required: false` in both Drupal config sync and v2 schema.
- Page layout uses `clamp(1rem, 5vw, 3rem)` for horizontal padding on `.app-shell`, `.app-content`, `.main-content`, and `.container`.

### Fixed
- 422 errors on draft application creation caused by stale Drupal entity field discovery cache and residual `required: true` flags on late-step fields. Fixed via cache rebuild and `fix_required_fields.php` script updating affected bundles.
- Nested `<form>` in `AddressPicker` caused outer Step 1 form to submit when "Save Address" was clicked.
- Nested `<form>` in `PersonPicker` caused outer step form to submit when "Save Person" was clicked.
- Dashboard crash ("Cannot assign to read only property '0'") when sorting completed steps from frozen Redux array.

### Ops Notes
- After deploying changes to `required` flags on Drupal fields, run `drush cr` in the container to flush entity field discovery cache, or 422 errors will persist until the next full container restart.
- `field_relationship_to_student` on `person` nodes in existing data is preserved but no longer populated by the frontend. Admin users may still set it via the Drupal UI.

## v0.0.0 - YYYY-MM-DD

### Added
- 

### Changed
- 

### Fixed
- 

### Security
- 

### Breaking Changes
- 

### Ops Notes
- 

### References
- Tag: 
- Commit SHA: 
- Compare: 
- PRs: 
- Issues: 

## Release Manager Checklist

- [ ] `Unreleased` is complete and accurate.
- [ ] Breaking changes and required actions are clearly documented.
- [ ] Validation/tests passed for the release candidate.
- [ ] Docker images built from the tagged commit.
- [ ] Git tag created and pushed.
- [ ] GitHub Release published with notes from this file.
- [ ] Deployment metadata set (`GIT_COMMIT_SHA`; optional `GIT_TAG`, `APP_VERSION`).
- [ ] Post-deploy health verification completed.
