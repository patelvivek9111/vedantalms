# Discussion metrics — log queries and dashboards (Phase F)

Metrics are written as **single-line JSON** to stdout (`console.info` via `workflowObservability.service`), suitable for log aggregators (Datadog, CloudWatch Logs Insights, ELK, etc.).

## Common fields

- `event`: namespaced string, e.g. `metric.discussion_route_latency`
- `at`: ISO timestamp
- **Never** includes raw submission text, file names, or grade values (sanitized in `workflowObservability`).

## Metric catalog

| `event` | When emitted | Useful fields |
|---------|----------------|----------------|
| `metric.discussion_route_latency` | After each `/api/threads` or `/api/replies` response | `prefix`, `method`, `path`, `statusCode`, `durationMs`, `actorRole` |
| `metric.discussion_reply_pagination_timing` | Thread root or child reply page served | `threadId`, `count`, `source`, `durationMs`, `parentReplyId` (children) |
| `metric.discussion_mark_read_timing` | Successful mark-read | `threadId`, `userId`, `durationMs` |
| `metric.discussion_large_thread_access` | Root reply `total` ≥ 500 | `threadId`, `totalRootReplies` |
| `metric.discussion_reply_create_failed` | Reply persistence threw before return | `threadId`, `userId`, `code`, `message` |
| `metric.discussion_reply_duplicate_suppressed` | Idempotent replay or unique-key race resolved | `threadId`, `userId` |
| `metric.discussion_moderation_action` | Reply hidden or restored | `action`, `threadId`, `replyId`, `actorId` |
| `metric.discussion_hidden_grade_surface_request` | Student fetches thread with `includeGrades=true` while grade hidden | `threadId`, `userId` |
| `metric.discussion_hidden_grade_payload_block` | Serializer redacts hidden grade (existing) | `threadId` |
| `metric.discussion_access_denied` | Access layer denied (existing) | `code`, `statusCode` |

## Example queries

### CloudWatch Logs Insights (illustrative)

```
fields @timestamp, event, durationMs, path, statusCode
| filter event = "metric.discussion_route_latency"
| stats pct(durationMs, 95) as p95 by path
```

### Datadog log search

`@event:metric.discussion_reply_create_failed`

## Alerting ideas

- Anomaly on `discussion_reply_create_failed` count vs 7-day baseline.
- p95 `discussion_route_latency.durationMs` > threshold for `path:/api/threads/:id/replies`.

## Integrity JSON (non-metric)

Scripts such as `discussionIntegrityDashboard.js` print a **JSON document** (not prefixed with `metric.`) — route these to a separate pipeline or filter on absence of `event` field if needed.
