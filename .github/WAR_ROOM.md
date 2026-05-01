# Crafter PDF War Room Operating Guide

This guide defines how to run an effective cross-functional swarm using the custom agents and skills in this repository.

## Team Roles
- War Room Commander: orchestration and final priority decisions.
- UX Specialist: messaging, IA, conversion, and accessibility.
- Salesforce Architect: package architecture and platform risk.
- Salesforce Engineer: implementation planning and code delivery.
- QA Lead: release gates, test strategy, and quality risk.
- Project Manager: milestones, ownership, and timeline discipline.

## How to Start a Session
1. Open chat with `War Room Commander`.
2. Provide:
- Goal and deadline
- Current status
- Known blockers
- Decisions needed today
3. Ask commander to delegate targeted questions to each specialist agent.
4. Ask commander to produce the final priority stack (P0/P1/P2) and 24-hour commitments.

## Recommended Flow
1. Run `/war-room-priority` to set the decision frame.
2. Run specialist skills as needed:
- `/ux-review`
- `/salesforce-architecture-review`
- `/salesforce-implementation-plan`
- `/qa-release-gate`
- `/program-management-sprint`
3. Consolidate with `War Room Commander`.

## Session Output Standard
Every war-room output must include:
- Situation summary
- Prioritized worklist (P0/P1/P2)
- Owner and collaborator per item
- ETA and dependency notes
- Explicit decisions made
- Explicit open decisions

## Cadence
- Daily 15-minute tactical sync for in-flight work.
- Weekly 45-minute priority reset.
- Milestone go/no-go review led by QA Lead and Commander.
