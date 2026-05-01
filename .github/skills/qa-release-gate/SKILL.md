---
name: qa-release-gate
description: "Use for QA planning, release gate definition, regression-risk mapping, and go/no-go decisions for Salesforce package milestones."
argument-hint: "Provide release scope and target date."
user-invocable: true
---
# QA Release Gate

## Purpose
Create a risk-based QA plan and objective release gate for each milestone.

## Gate Design
1. Must-pass checks:
- Build and packaging sanity
- Critical user journeys
- Security and permission checks
2. Regression map:
- Previously working capabilities at risk
- Integration points likely to break
3. Test distribution:
- Unit tests
- Integration tests
- Manual exploratory tests
4. Exit criteria:
- Defect severity threshold
- Known issues accepted by product

## Output Template
- Must-pass gates:
- Test matrix:
- Highest risks:
- Defects blocking release:
- Go/No-Go:
