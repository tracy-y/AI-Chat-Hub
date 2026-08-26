# Contributing

## Workflow

1. Start from a clean `main` branch.
2. Create a `codex/<topic>` branch.
3. Keep one writer active in the working tree.
4. Implement the smallest complete change.
5. Run `npm run verify` and `git diff --check`.
6. Review the staged diff and scan for credentials or private conversations.
7. Commit locally. Push, merge, and release require explicit approval from the project owner.

## Non-negotiable boundaries

- Never commit passwords, tokens, cookies, browser profiles, or private chat data.
- Never rewrite captured official responses in place.
- Never reuse AI Council roles, routing, or Consensus.
- Never enable a real provider adapter before its P0 assessment is accepted.
- Never bypass login, CAPTCHA, MFA, rate limits, paywalls, or platform controls.
