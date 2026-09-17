# ADR 002: Preserve the last valid market and news data

Status: accepted

## Context

NewBoy displays external market quotes and news. Providers, proxies, and local networks can fail temporarily. Creating replacement values would make the portfolio appear functional while presenting false information.

## Decision

When an external request fails, retain the last successfully verified value or expose an unavailable/error state. Do not fabricate quotes, movements, headlines, timestamps, or provider results. Retry only according to the provider-specific network and rate-limit policy.

## Consequences

- Users may temporarily see stale values during an outage.
- The interface must distinguish connecting, stale, unavailable, and live states where appropriate.
- Tests and demos cannot seed plausible production-looking fallback data unless it is explicitly labelled fixture data and isolated from runtime feeds.

