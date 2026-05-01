---
name: salesforce-architecture-review
description: "Use for Salesforce architecture and packaging reviews, AppExchange security readiness, source structure decisions, and technical debt mapping."
argument-hint: "Provide architecture context and release target."
user-invocable: true
---
# Salesforce Architecture Review

## Purpose
Evaluate architecture decisions and readiness for AppExchange-oriented delivery.

## Review Areas
1. Repository maturity:
- Is there enough source to validate architecture claims?
- Are architecture assumptions explicitly documented?
2. Packaging:
- Package directory structure
- Versioning strategy
- Namespace and source API alignment
3. Security review readiness:
- Data flow boundaries
- Callout surface
- Permission model and secrets handling
4. Extensibility:
- Metadata-driven configuration model
- Apex/LWC boundaries
- Upgrade-safe design

## Output Template
- High-risk architecture gaps:
- Security readiness status:
- Decision records needed now:
- Next architecture milestones:
