# Requirements Map

Issue #20 asks for Revenue Infrastructure covering tiered subscriptions, AI compute billing, usage meters, top-ups, institutional invoicing, and licensing analytics.

This contribution focuses on the AI compute billing control boundary.

| Issue Area | Evidence In This Module |
| --- | --- |
| AI compute billing | `index.js` evaluates model/tool/reproducibility events into billable meter rows. |
| Transparent usage meters | `meterRows` include raw event IDs, retained billable event, action, reason, raw cents, billable cents, and avoided overbill cents. |
| Institutional invoice readiness | `accountSummaries` mark accounts as `ready` or `hold` before invoice posting. |
| Top-up and quota safety | Duplicate retry rows and raw-count inflation are reported before consuming paid usage or recognizing revenue. |
| Finance audit evidence | `demo.js` emits `reports/summary.json`, `reports/finance-review-packet.md`, and a deterministic `auditDigest`. |
| Reviewer verification | `test.js` covers retry collapse, nondeterministic rerun holds, raw-count inflation, account hold status, and digest stability. |

## Distinctness

This is not another generic subscription engine, metering ledger, dispute guard, SLA credit calculator, royalty settlement module, forecast, FX reconciliation, procurement control, invoice acceptance gate, sanctions/export-control gate, payment rail failover, entitlement downgrade guard, or usage anomaly credit memo.

The slice specifically addresses AI compute retry idempotency and attribution correctness before usage becomes billable revenue.
