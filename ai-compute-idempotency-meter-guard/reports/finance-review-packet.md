# AI Compute Idempotency Meter Guard

Status: finance_review_required

## Totals
- Raw events: 10
- Idempotency groups: 3
- Collapsed retry rows: 2
- Held rows: 1
- Billable cents: 3.59
- Avoided overbill cents: 94.46
- Audit digest: 5204e71ba374a26a8124c985bc4c66669ef462ded0da97fed3d3a21ecd0cc5bf

## Account Decisions
- institute-helix: ready, billable 1.44c, avoided 1c, critical findings 0
- lab-northbridge: ready, billable 2.15c, avoided 2.96c, critical findings 0
- lab-westlake: hold, billable 0c, avoided 90.5c, critical findings 3

## Highest-Risk Findings
- critical: rerun_scope_undefined (lab-westlake) - Nondeterministic reproducibility events share an undefined billing scope. Hold the invoice row until finance defines run-vs-verified-output responsibility.
- high: raw_count_inflation (lab-northbridge) - Raw compute events materially exceed distinct account/source/day attribution. Review before invoicing usage counts.
- high: raw_count_inflation (institute-helix) - Raw compute events materially exceed distinct account/source/day attribution. Review before invoicing usage counts.
- critical: rerun_scope_undefined (lab-westlake) - Nondeterministic reproducibility rerun lacks a billing-scope policy. Hold charges until run-vs-verified-output responsibility is defined.
- critical: rerun_scope_undefined (lab-westlake) - Nondeterministic reproducibility rerun lacks a billing-scope policy. Hold charges until run-vs-verified-output responsibility is defined.
