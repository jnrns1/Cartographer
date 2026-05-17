# LLM enrichment design (v0.2)

v0.1 detection and recommendations are deterministic: pure regex rules and
template recommendations that each name a specific Ortus module or BoxLang
feature. No model is called. This document records the v0.2 design so the
seams are intentional now.

## Why deferred

Deterministic output is reviewable, idempotent, and free. It is the right
default for a marketplace app that writes into a customer's Jira and
Confluence. LLM enrichment improves the prose and the harder categories
(architecture, modernization) but adds cost, latency, and non-determinism, so
it ships as an opt-in v0.2 feature.

## Planned approach

- An optional enrichment pass after synthesis, before `putWorkItem`, that
  rewrites `recommendation` and tightens `confidence` for low-confidence
  architecture and modernization items only.
- Provider: Atlassian Rovo where available, or an operator-supplied API key
  stored encrypted in KVS, behind a feature flag in `src/lib/features.ts`.
- The enricher takes a `WorkItem` plus the file snippet and returns only a
  revised recommendation string and an optional confidence bump. It never
  changes the rule id, category, phase, or effort, so the plan and Jira
  hierarchy stay stable and the change is auditable.
- Strictly bounded: capped tokens per item, capped items per scan, and a hard
  fallback to the deterministic template on any error or timeout.

## Not in scope for v0.2

Auto-fixing code, transpilation, or any write back to the source tree.
Cartographer stays read-only against the codebase.
