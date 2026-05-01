# Contributing to Crafter PDF

Crafter PDF is a Salesforce-native, client-side PDF generator. This guide covers local development setup, branching conventions, and the review process.

## Prerequisites
- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) v2+
- [Node.js](https://nodejs.org/) v20+
- A Salesforce Dev Hub org (free [Developer Edition](https://developer.salesforce.com/signup) works)
- VS Code + [Salesforce Extension Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode)

## Local Development Setup

```bash
# 1. Clone and enter the repo
git clone https://github.com/FairCloudCrafter/crafter-pdf.git
cd crafter-pdf

# 2. Authorize your Dev Hub
sf org login web --alias devhub --set-default-dev-hub

# 3. Create a scratch org
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias crafter-dev \
  --duration-days 7

# 4. Deploy source
sf project deploy start --target-org crafter-dev

# 5. Open the org in the browser
sf org open --target-org crafter-dev
```

## Project Structure

```
force-app/main/default/
├── classes/          # Apex services
├── customMetadata/   # CrafterPdfTemplate__mdt records
├── lwc/              # Lightning Web Components
├── objects/          # Custom object and field metadata
└── staticresources/  # jsPDF, Chart.js bundles
```

## Branching Convention

| Branch prefix | Purpose |
|---|---|
| `main` | Stable, AppExchange-ready |
| `develop` | Integration branch |
| `feature/xxx` | Feature work |
| `fix/xxx` | Bug fixes |
| `chore/xxx` | Non-feature changes (docs, deps) |

## Running Apex Tests

```bash
sf apex run test --target-org crafter-dev --code-coverage --result-format human
```

## Submitting a PR
1. Branch from `develop`.
2. Keep changes focused on one feature or fix.
3. Ensure all Apex tests pass before opening the PR.
4. Reference the issue number in the PR title.
5. Fill in the PR description with: what, why, how to test.

## Questions
Email [hello@faircloudcrafter.com](mailto:hello@faircloudcrafter.com) or open an issue.
