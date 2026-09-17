# ADR 003: Keep the integrated Hotaru script as a frozen copy

Status: accepted

## Context

The canonical Hotaru implementation belongs to `skill-lab/HypeBoyImgTool/hotaru/`, while NewBoy needs local Python files for backend process execution. Editing both copies independently would cause silent divergence.

## Decision

Treat `server/python/hotaru.py` as a frozen runtime copy. Make substantive changes in the upstream project, validate them there, and synchronize the approved version into NewBoy as an explicit integration change.

## Consequences

- NewBoy-specific fixes must first be evaluated for the upstream source.
- Synchronization commits should state the upstream source and validation performed.
- An agent must not patch the frozen file in isolation merely because it is the locally executed copy.
