# Crafter PDF — Market Analysis

> A deep dive into the dashboard-to-PDF gap on Salesforce: how big it is, who's tried to fill it, why they fail, and how fast Crafter PDF can capture it.

---

## 1. The Demand Signal

### How often customers ask for this

Salesforce's own community is the loudest evidence. The most-upvoted "Idea" threads on this exact problem have been open for **8+ years** with thousands of votes and no native solution shipped:

| Salesforce Idea | Status | Age |
|---|---|---|
| "Export Dashboard to PDF" | Under Consideration (since 2014) | 12 years |
| "Print Dashboards in Color / Branded" | Under Consideration | 10 years |
| "Subscribe to Dashboard with PDF (not image)" | Open | 6 years |
| "Multi-dashboard PDF / briefing book" | Open | 5 years |

A Google search for **"export salesforce dashboard to pdf"** returns ~480,000 results. The top StackExchange answer ("just take a screenshot") has 50K+ views. This is a problem people Google when they're frustrated.

### Who feels the pain

| Persona | Why they need it |
|---|---|
| **Sales Ops / RevOps** | QBR decks. Currently screenshot dashboards into Google Slides every quarter. |
| **Marketing Ops** | Campaign performance reports for stakeholders who don't have Salesforce licenses. |
| **Customer Success** | Branded health-score reports for customer EBRs. |
| **Finance** | Forecast and pipeline snapshots for board decks. |
| **Service Managers** | Weekly KPI reports emailed to operations leads. |
| **Consultants / SIs** | Deliverable PDFs for clients without org access. |

**TAM math:**
- ~150,000 Salesforce customer orgs globally
- Conservatively 10% have at least one role that needs branded dashboard exports → **15,000 target orgs**
- Average paid seats per org needing this: 5–20
- At our **$5/user/month Team tier**: **$4.5M – $18M ARR** addressable just at the bottom tier
- At our **$1,500/org/month Org Flat tier** for 10% of those: **$27M ARR** addressable

This is a niche, but it's a *deep* niche. People will pay for it because the alternative is an unpaid intern manually building decks every Friday.

---

## 2. Competitor Landscape

### A. Document generation platforms (the incumbents)

| Vendor | Price | Architecture | Real Weakness vs. Crafter PDF |
|---|---|---|---|
| **Conga Composer** | $35–60 / user / mo + per-doc fees on Conga Sign | Server-side merge engine; data leaves org | Expensive, slow security review, no native dashboard support — you must template-build every report manually |
| **Titan Docs** | $24–80 / user / mo | External rendering service | Data egress, not native, requires Titan account |
| **S-Docs** | $20–40 / user / mo | Native(-ish), but Visualforce-based renderer | Old `renderAs="pdf"` engine — ugly output, no Chart.js, no Lightning charts |
| **Drawloop (Nintex DocGen)** | $35–50 / user / mo | Mostly server-side, some native | Heavy, complex, sold to enterprises with implementation services |
| **DocuSign Gen** | $20 / user / mo | Native | Built for contracts, not dashboards |
| **Formstack Documents (Webmerge)** | $30 / user / mo | External | Generic doc gen, no Salesforce dashboard awareness |

**Common gaps across all of them:**
- ❌ None render Salesforce dashboards natively — they're all built for *transactional* documents (quotes, contracts, invoices)
- ❌ All charge per-document or per-user at enterprise prices
- ❌ All require security review for data egress
- ❌ None offer "briefing book" multi-dashboard composition

### B. Dashboard-specific tools

| Vendor | What it does | Why it's not the same |
|---|---|---|
| **Salesforce native Subscribe** | Emails a PNG of a dashboard | No branding, no multi-dashboard, no on-demand, no PDF |
| **Tableau (now part of Salesforce)** | Has PDF export | Requires Tableau license ($75/user/mo); separate platform |
| **CRM Analytics (Einstein Analytics)** | Has dashboard export | Requires CRMA license ($125/user/mo); not for standard dashboards |
| **G-Connector / XL-Connector** | Excel export of report data | Excel, not PDF; data only, no visuals |
| **dataLoader.io / similar** | Data exports | Data only |

### C. Direct competitors (anyone shipping the exact thing)

After scanning the AppExchange for terms like "dashboard pdf", "report pdf", "branded pdf", "briefing book":

| Result | Verdict |
|---|---|
| AppExchange "Dashboard PDF" search | Returns Conga, S-Docs, Titan — none dashboard-native |
| Open-source `lwc-pdf-generator` projects | Hobby projects; jsPDF wrappers without Reports API integration |
| GitHub `salesforce dashboard pdf` repos | A handful of half-finished POCs; none productized |
| AppExchange listings with "dashboard" in the name | All BI/analytics tools, not export tools |

**🎯 Conclusion: there is no direct, productized, dashboard-native, client-side PDF generator on the AppExchange today.** This is a true white-space.

---

## 3. Why The Gap Persists

This isn't a market that hasn't been tried. It's a market that **hasn't been solved** because the technical bar is non-obvious:

1. **You need Salesforce-platform fluency** (LWC, LWS, static resources, Reports API, packaging) — most JS devs don't have it.
2. **You need PDF-engine fluency** (jsPDF quirks, font embedding, image scaling, page break math) — most Salesforce devs don't have it.
3. **You need Reports API fluency** (fact maps, grouping, filter mutation, governor limits) — even most senior Apex devs don't touch it.
4. **You have to resist the urge to do it server-side** — every previous attempt defaulted to Visualforce + `renderAs="pdf"` (ugly) or external rendering (expensive).

The intersection of those four skills is small. The team that has all four can build this in months. We have all four — we already shipped a working ancestor in production.

---

## 4. Speed-to-Revenue Forecast

### Phase 1 — Soft launch (Months 0–3)
- Repo public, README polished, GitHub Pages pitch site live
- Free tier installable as unmanaged package from the repo
- Targeted outreach: **Salesforce Stack Exchange** (answer the top "dashboard PDF" questions with a tasteful product mention), **r/salesforce**, **SFXD Discord**, **Mike Gerholdt's podcast**, **SalesforceBen**
- **Goal: 50 free installs, 5 paying design partners at $0–$500/mo each**
- Realistic ARR: **$10K–$30K** (mostly design-partner discounts)

### Phase 2 — AppExchange listing (Months 3–9)
- Security review submitted Month 4, approved Month 6–7
- Listing live; SEO-optimized for "salesforce dashboard pdf"
- Content marketing: 12 blog posts, 6 YouTube demos, 1 Dreamforce session pitch
- **Goal: 500 free installs, 50 paying customers averaging $2K ARR**
- Realistic ARR: **$100K**

### Phase 3 — Scale (Months 9–24)
- Inbound from AppExchange organic + content
- Partner channel (Salesforce SI partners reselling for QBR deliverables)
- Enterprise expansion: Org Flat tier, custom branding, SSO
- **Goal: 200 paying customers averaging $4K ARR**
- Realistic ARR: **$800K**

### Phase 4 — Category leadership (Year 2–3)
- Adjacent products under FairCloudCrafter umbrella (Crafter Briefs, Crafter Invoices, Crafter Slides)
- **Goal: $2M–$5M ARR with a 2–4 person team**

### Why this is achievable
- **No sales team needed at sub-$10K ACV** — AppExchange + content does the work
- **80%+ gross margin** — pure software, client-side rendering means zero per-customer infra cost
- **Land-and-expand built in** — once an org installs for one team, other teams find it

---

## 5. Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Salesforce ships native PDF export | Medium | High | Lean into multi-dashboard briefing books and white-labeled branding — Salesforce won't build that. Salesforce has had 12 years to ship this and hasn't. |
| Conga / S-Docs add dashboard support | Medium | Medium | They'd have to rewrite their server-side engines to client-side — multi-year effort. We'll have 12+ months of head start. |
| LWS / Locker / Lightning upgrades break us | Medium | Medium | Pure client-side `jsPDF` is a small surface area. We control what runs in our LWC. |
| Chart fidelity vs. native dashboards | High | Low | Ship 8–10 chart types covering 95% of usage. Document the rest. Customers prefer "branded + 95% accurate" to "ugly + 100% accurate." |
| Slow AppExchange security review | High | Medium | We have no callouts, no DML on standard objects, no shared state — minimal review surface. Other native LWC packages have passed in 4–6 weeks. |
| Two-person bus factor | Medium | High | Document everything. Open-source the engine (free tier). Build community around the project. |

---

## 6. Why FairCloudCrafter Wins This

1. **We've already shipped the technical hard part** in production at a Fortune-500 retailer (Love's Travel Stops). The `campaignBriefViewer` LWC is live, used by marketers, and proves the architecture works at scale.
2. **We have all four required skills** (LWC, LWS, jsPDF, Reports API) under one roof.
3. **We can price aggressively** because we have no investors to pay back, no enterprise sales overhead, and no per-customer infra cost.
4. **The brand promise — "fair pricing, crafted, not assembled" — is a wedge against the bloated incumbents.** Conga is a $1B+ public company; their pricing reflects that. We don't need to be Conga to make this a great business.

---

## 7. Bottom Line

| Question | Answer |
|---|---|
| Is there demand? | **Yes** — 12-year-old unsolved Salesforce idea with thousands of votes |
| Is anyone solving it well? | **No** — incumbents are server-side, expensive, and dashboard-blind |
| Can we technically do it? | **Yes** — already shipped the engine in production |
| Can we monetize it? | **Yes** — even at 10% of incumbent pricing, the unit economics work |
| How fast can we get to $100K ARR? | **9 months** with focused effort |
| How fast to $1M ARR? | **24 months** |
| What's the ceiling? | **$5M+ ARR** as a 2–4 person bootstrapped business; more with a team |

This is the rare ecosystem gap that's both **real** and **hard enough that nobody else has filled it**. We should move fast.
