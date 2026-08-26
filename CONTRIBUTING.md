# Contributing

## Workflow

This is a personal project, so the default workflow stays deliberately small:

1. State the intended outcome and keep one writer active in the working tree.
2. Implement the smallest verifiable change. Use a `codex/<topic>` branch for feature-sized work; tiny documentation fixes do not require one.
3. Run tests proportional to risk. Changes involving credentials, captured responses, storage, or migrations require `npm run verify`, `git diff --check`, and a credential scan.
4. Codex may create local commits after checks pass. Push, merge, account changes, destructive migrations, and releases require explicit owner approval.

Issues, pull requests, ADRs, changelogs, and separate test reports are optional unless they materially improve safety, explain a high-impact decision, or prepare a public release.

## Non-negotiable boundaries

- Never commit passwords, tokens, cookies, browser profiles, or private chat data.
- Never rewrite captured official responses in place.
- Never reuse AI Council roles, routing, or Consensus.
- Never enable a real provider adapter before its P0 assessment is accepted.
- Never bypass login, CAPTCHA, MFA, rate limits, paywalls, or platform controls.
