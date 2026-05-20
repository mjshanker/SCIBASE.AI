# AI Compute Idempotency Meter Guard

Status: finance_review_required

## Totals
- Raw events: 10
- Idempotency groups: 3
- Collapsed retry rows: 3
- Held rows: 0
- Billable cents: 49.13
- Avoided overbill cents: 48.92
- Audit digest: ad26f7c740cbb04048d433ab53d4eadcc33a9920393ebcf22651f6bfa19b818d

## Account Decisions
- institute-helix: ready, billable 1.44c, avoided 1c, critical findings 0
- lab-northbridge: ready, billable 2.15c, avoided 2.96c, critical findings 0
- lab-westlake: hold, billable 45.54c, avoided 44.96c, critical findings 2

## Highest-Risk Findings
- high: raw_count_inflation (lab-northbridge) - Raw compute events materially exceed distinct account/source/day attribution. Review before invoicing usage counts.
- high: raw_count_inflation (institute-helix) - Raw compute events materially exceed distinct account/source/day attribution. Review before invoicing usage counts.
- critical: rerun_scope_undefined (lab-westlake) - Nondeterministic reproducibility rerun lacks a billing-scope policy. Hold charges until run-vs-verified-output responsibility is defined.
- critical: rerun_scope_undefined (lab-westlake) - Nondeterministic reproducibility rerun lacks a billing-scope policy. Hold charges until run-vs-verified-output responsibility is defined.
