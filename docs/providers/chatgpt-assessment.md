# ChatGPT provider assessment

- Status: `Revise / Unconfirmed`
- Checked: 2026-08-26
- Account access performed: No

## Intended route

Use a user's existing ChatGPT web subscription from a public third-party browser extension, without exporting cookies and without default API billing.

## Official documentation observed

The OpenAI developer portal presents the API Platform as the supported way to build AI experiences and separately presents ChatGPT/Codex extension mechanisms. The reviewed official developer material did not document a general interface that allows a third-party public extension to automate the consumer ChatGPT website using a user's subscription.

Source: <https://developers.openai.com/>

## Decision

- Do not claim that consumer ChatGPT subscription automation is officially supported.
- Do not add `chatgpt.com` host permissions, selectors, automatic submission, response scraping, or cookie access at this stage.
- Keep a manual-assisted route as a candidate: open ChatGPT, let the user send normally, then let the user explicitly paste the copied response into Hub.
- Reassess if OpenAI publishes an explicit supported integration for this use case or grants permission.

## Data boundary

No ChatGPT email, account ID, subscription status, cookie, session token, browser profile, or private conversation may enter the repository, logs, fixtures, or assessment evidence.
