# Claude provider assessment

- Status: `Stop` for automated subscription-web access
- Checked: 2026-08-26
- Account access performed: No

## Intended route

Use a user's existing Claude web subscription from a public third-party browser extension, without exporting cookies and without default API billing.

## Official findings

Anthropic's current Consumer Terms prohibit automated or non-human access unless the service is accessed through an Anthropic API key or Anthropic otherwise explicitly permits it. The same terms also prohibit crawling, scraping, or harvesting service data except where permitted.

Anthropic separately states that a paid Claude subscription covers its web, desktop, and mobile chat products but does not include Claude API or Console access.

Sources:

- <https://www.anthropic.com/legal/consumer-terms>
- <https://support.claude.com/en/articles/9876003-i-have-a-paid-claude-subscription-pro-max-team-or-enterprise-plans-why-do-i-have-to-pay-separately-to-use-the-claude-api-and-console>

## Decision

- Do not implement automatic prompt submission, DOM response capture, scraping, or background interaction against `claude.ai` using a consumer subscription.
- Do not add `claude.ai` host permissions for that purpose.
- A manual-assisted route remains a candidate: open Claude, let the user interact normally, and let the user explicitly paste a copied response into Hub.
- An API adapter may be offered only as a separate opt-in mode with user-supplied credentials and clear separate billing.
- Reassess automated access only if Anthropic provides explicit permission or a supported subscription integration.

## Data boundary

No Claude email, account ID, subscription status, cookie, API key, session token, browser profile, or private conversation may enter the repository, logs, fixtures, or assessment evidence.
