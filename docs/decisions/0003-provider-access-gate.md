# ADR 0003: Real provider access gate

- Status: Proposed
- Date: 2026-08-26

## Context

The product is subscription-first and is intended for public GitHub distribution. Each user supplies their own official account. Public distribution does not itself grant permission to automate consumer websites.

The Claude P0 found a current express restriction on automated consumer access without an API key or explicit permission. The reviewed OpenAI developer documentation did not establish a supported consumer ChatGPT web-automation interface for this product.

## Safe options

### Option A — Assisted manual relay

Hub opens each official site. The user manually sends the prompt and explicitly copies the official response back into Hub. Hub stores and displays the pasted original without modifying it.

- Preserves subscription-first positioning.
- Requires no host permission, cookie access, scraping, or automated submission.
- Has more manual steps and cannot guarantee source authenticity without user confirmation.

### Option B — Optional user-supplied API adapters

Users opt in with their own API credentials and accept separate provider billing.

- Uses documented developer interfaces and supports reliable automation.
- Does not satisfy subscription-only usage and adds secret-management requirements.

### Option C — Wait for explicit supported integrations

Keep Mock and manual workflows until providers publish a suitable interface or grant permission.

- Lowest account and policy risk.
- Delays automatic multi-provider submission.

## Recommendation

Implement Option A as the next MVP slice, keep Option B outside the default path, and continue monitoring for Option C. Do not implement consumer-site automation based only on DOM selectors.
