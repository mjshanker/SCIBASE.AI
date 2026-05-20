import { createHash } from "node:crypto"

export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

export function buildIdempotencyKey(event) {
  return sha256(
    stableStringify({
      accountId: event.accountId,
      operation: event.operation,
      model: event.model,
      promptHash: event.promptHash,
      params: event.params,
      toolName: event.toolName ?? null,
      toolArgsHash: event.toolArgsHash ?? null,
      sourceDocumentId: event.sourceDocumentId ?? null,
    }),
  )
}

export function buildAttributionKey(event) {
  const day = event.startedAt.slice(0, 10)
  return [event.accountId, event.sourceDocumentId ?? event.requestId, day].join(":")
}

function centsFor(event, policy) {
  const tokenCents =
    ((event.inputTokens ?? 0) + (event.outputTokens ?? 0)) *
    policy.centsPerToken
  const wallCents =
    ((event.wallClockMs ?? 0) / 60000) * policy.centsPerWallMinute
  return Math.round((tokenCents + wallCents) * 100) / 100
}

function chooseBillableEvent(events) {
  return (
    events.find((event) => event.lifecycle === "tool_result" && event.status === "success") ??
    events.find((event) => event.lifecycle === "completion" && event.status === "success") ??
    events.find((event) => event.status === "success")
  )
}

function evaluateGroup(events, policy) {
  const billableEvent = chooseBillableEvent(events)
  const hasOrphanedToolUse =
    events.some((event) => event.lifecycle === "tool_use") &&
    !events.some((event) => event.lifecycle === "tool_result")
  const hasFailedRetry = events.some((event) => event.lifecycle === "retry")
  const statuses = new Set(events.map((event) => event.status))
  const rawCents = events.reduce((sum, event) => sum + centsFor(event, policy), 0)

  if (hasOrphanedToolUse) {
    return {
      action: "hold",
      reason: "orphaned_tool_call",
      billableCents: 0,
      rawCents,
      retainedEventId: null,
      finding:
        "Tool call emitted without a matching result. Hold billing until retry/result reconciliation is explicit.",
    }
  }

  if (!billableEvent) {
    return {
      action: "hold",
      reason: `no_successful_terminal_event:${[...statuses].sort().join("|")}`,
      billableCents: 0,
      rawCents,
      retainedEventId: null,
      finding: "No successful terminal event was found for this idempotency group.",
    }
  }

  const billableCents = centsFor(billableEvent, policy)
  const duplicateCount = Math.max(0, events.length - 1)
  return {
    action: hasFailedRetry || duplicateCount > 0 ? "collapse" : "invoice",
    reason:
      hasFailedRetry || duplicateCount > 0
        ? "content_hash_retry_collapse"
        : "single_terminal_event",
    billableCents,
    rawCents,
    retainedEventId: billableEvent.id,
    finding:
      duplicateCount > 0
        ? `${duplicateCount} retry or duplicate rows collapsed behind one content-hash meter row.`
        : "Single terminal meter row is invoice-ready.",
  }
}

function evaluateSourceInflation(events, policy) {
  const rawByAccount = new Map()
  const distinctByAccount = new Map()

  for (const event of events) {
    if (event.excludeFromAttribution) continue
    rawByAccount.set(event.accountId, (rawByAccount.get(event.accountId) ?? 0) + 1)
    if (!distinctByAccount.has(event.accountId)) {
      distinctByAccount.set(event.accountId, new Set())
    }
    distinctByAccount.get(event.accountId).add(buildAttributionKey(event))
  }

  const findings = []
  for (const [accountId, rawCount] of rawByAccount.entries()) {
    const distinctCount = distinctByAccount.get(accountId)?.size ?? 0
    const ratio = distinctCount === 0 ? rawCount : rawCount / distinctCount
    if (ratio >= policy.rawToDistinctInflationThreshold) {
      findings.push({
        accountId,
        severity: "high",
        code: "raw_count_inflation",
        rawCount,
        distinctCount,
        ratio: Number(ratio.toFixed(2)),
        message:
          "Raw compute events materially exceed distinct account/source/day attribution. Review before invoicing usage counts.",
      })
    }
  }
  return findings
}

function evaluateReproducibilityRuns(events) {
  return events
    .filter(
      (event) =>
        event.operation === "reproducibility_check" &&
        event.reproducibility?.deterministic === false &&
        !event.reproducibility?.billingScope,
    )
    .map((event) => ({
      accountId: event.accountId,
      severity: "critical",
      code: "rerun_scope_undefined",
      eventId: event.id,
      message:
        "Nondeterministic reproducibility rerun lacks a billing-scope policy. Hold charges until run-vs-verified-output responsibility is defined.",
    }))
}

export function evaluateComputeBilling(events, policy) {
  const groups = new Map()
  for (const event of events) {
    const key = buildIdempotencyKey(event)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ ...event, idempotencyKey: key })
  }

  const meterRows = []
  const groupFindings = []
  for (const [idempotencyKey, groupedEvents] of groups.entries()) {
    const result = evaluateGroup(groupedEvents, policy)
    meterRows.push({
      idempotencyKey,
      accountId: groupedEvents[0].accountId,
      operation: groupedEvents[0].operation,
      eventIds: groupedEvents.map((event) => event.id).sort(),
      retainedEventId: result.retainedEventId,
      action: result.action,
      reason: result.reason,
      rawCents: Number(result.rawCents.toFixed(2)),
      billableCents: Number(result.billableCents.toFixed(2)),
      avoidedOverbillCents: Number(
        Math.max(0, result.rawCents - result.billableCents).toFixed(2),
      ),
    })
    groupFindings.push({
      accountId: groupedEvents[0].accountId,
      severity: result.action === "hold" ? "critical" : "info",
      code: result.reason,
      idempotencyKey,
      message: result.finding,
    })
  }

  const findings = [
    ...groupFindings,
    ...evaluateSourceInflation(events, policy),
    ...evaluateReproducibilityRuns(events),
  ]
  const heldAccountIds = new Set(
    findings
      .filter((finding) => finding.severity === "critical")
      .map((finding) => finding.accountId),
  )

  const accountSummaries = [...new Set(events.map((event) => event.accountId))]
    .sort()
    .map((accountId) => {
      const rows = meterRows.filter((row) => row.accountId === accountId)
      const criticalFindings = findings.filter(
        (finding) =>
          finding.accountId === accountId && finding.severity === "critical",
      )
      return {
        accountId,
        status: criticalFindings.length > 0 ? "hold" : "ready",
        billableCents: Number(
          rows.reduce((sum, row) => sum + row.billableCents, 0).toFixed(2),
        ),
        avoidedOverbillCents: Number(
          rows
            .reduce((sum, row) => sum + row.avoidedOverbillCents, 0)
            .toFixed(2),
        ),
        meterRows: rows.length,
        criticalFindings: criticalFindings.length,
      }
    })

  const report = {
    status: heldAccountIds.size > 0 ? "finance_review_required" : "invoice_ready",
    generatedAt: policy.generatedAt,
    totals: {
      rawEvents: events.length,
      idempotencyGroups: groups.size,
      heldRows: meterRows.filter((row) => row.action === "hold").length,
      collapsedRows: meterRows.filter((row) => row.action === "collapse").length,
      billableCents: Number(
        meterRows.reduce((sum, row) => sum + row.billableCents, 0).toFixed(2),
      ),
      avoidedOverbillCents: Number(
        meterRows
          .reduce((sum, row) => sum + row.avoidedOverbillCents, 0)
          .toFixed(2),
      ),
    },
    accountSummaries,
    meterRows,
    findings,
  }

  return {
    ...report,
    auditDigest: sha256(stableStringify(report)),
  }
}
