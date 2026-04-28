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
