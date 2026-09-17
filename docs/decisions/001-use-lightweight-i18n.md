# ADR 001: Use a lightweight in-house i18n layer

Status: accepted

## Context

NewBoy needs immediate Chinese and English switching across a desktop-style single-page experience. Locale-prefixed URLs would add routing complexity without improving the primary interaction model. Translation completeness also needs compile-time enforcement.

## Decision

Use `LanguageProvider`, an `nb-lang` cookie, and a typed dictionary in `frontend/src/lib/i18n/dict.ts`. Chinese defines the complete key set and the English dictionary must satisfy that shape. Server-rendered routes read the cookie, while client components switch immediately through context.

Use translation keys for static window definitions. Keep runtime-generated document and task titles as strings. Backend errors use a separate request-scoped dictionary and persist translation keys for background jobs.

## Consequences

- Missing English UI translations fail TypeScript checks.
- Language changes do not require route changes or an external i18n dependency.
- Components outside React context must use an approved module-level translation helper or move translation into a component boundary.
- Content with its own bilingual fields remains separate from interface strings.

