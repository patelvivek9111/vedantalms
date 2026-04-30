# Production Readiness Progress Dashboard

Single source of truth for Day 1 to Day 7 work.

## Overall Status

- Day 1: Code complete (operational checklist still applies in prod)
- Day 2: Closed in repo + **local stack validated** (Prometheus/Grafana/Alertmanager compose, Grafana Slack test, `GF_SERVER_ROOT_URL` on 3100, Grafana data volume; put real Slack URL in `alertmanager.dev.yml` only when proving Prometheus→Alertmanager path)
- Day 3: Complete (hot paths + cache + benchmark checkpoint)
- Day 4: Closed in repo (throttles + engine tuning + validation scripts; full QuizWave cross-node UX still verify behind prod LB when deployed)
- Day 5: Closed for round 1 (public + API JWT ramps completed, post-fix re-run recorded, and high-sample Day 3 benchmark captured)
- Day 6: Completed (60-minute soak run + confirmatory safer-envelope run recorded; failure injection still pending)
- Day 7: Drafted (go/no-go recommendation recorded; awaiting production checklist sign-off)

### Forward plan — finish the week (recommended order)

Treat this as a **rolling 7-day execution calendar** (start any day; keep order).

| Day | Focus | Do this |
| --- | --- | --- |
| **1** | **Day 5 closeout** | Run `npm run check:day5` (public paths) — done once. Run **`npm run check:day5:api`** (JWT hot routes; gentler conc); note **429** counts and p95. Raise `DAY3_BENCH_REQUESTS` and re-run **`npm run check:day3`** for stable percentiles. **Write one paragraph:** top risk + fix or “defer with reason”. |
| **2** | **Fix #1 bottleneck** | Pick the worst signal (rate limit, Mongo pool, N+1, cache miss). Ship a **small** code or config change; re-run `check:day5:api` or `check:day3` to prove improvement. |
| **3** | **Day 1 prod checklist (real env)** | Staging/prod: 2–3 instances, LB, `REDIS_URL`, managed Mongo, `FORCE_OBJECT_STORAGE`, secrets rotated. **`npm run check:day1`** + **`smoke:predeploy`** against real URLs. |
| **4** | **Day 6 soak prep** | Longer run: leave **`check:day5`** or API ramp **longer** (`DAY5_PHASE_DURATION_MS` / higher max only on staging), or run **`check:day3`** in a loop for 1–2h. **`obs:up`**; watch Grafana for p95 / 5xx / Mongo. |
| **5** | **Day 6 failure injection** | Restart Redis or one app node during soak; confirm recovery + alerts (Slack). Document RTO. |
| **6** | **Day 7 draft** | Capacity note: “safe envelope” for RPS / concurrent users tested; list **go** vs **no-go** blockers. |
| **7** | **Go / No-Go** | Sign-off: prod checklist green, soak acceptable, rollback plan named, owner for on-call. |

**Principle:** one **measurable** step per day beats unfinished parallel work. **Staging first** for destructive or high load tests.

---

## Day 1 - Production Infra Baseline

### Scope
- Multi-instance backend behind LB (min 3)
- Managed Mongo replica cluster
- Managed Redis + `REDIS_URL`
- Object storage only in production (no local fallback)
- Secure secret rotation

### Implemented in code
- Production startup guards for critical env requirements
- `/health/ready` readiness endpoint with dependency checks
- Production upload behavior blocks local fallback when object storage is required
- `npm run check:day1` + `npm run smoke:predeploy` validation commands

### Operational Checklist (must complete in production)
- [ ] Deploy backend with minimum 3 instances behind one load balancer
- [ ] Set `APP_HEALTH_URLS` to all 3 instance health URLs
- [ ] Provision managed Redis and set `REDIS_URL`
- [ ] Set `REQUIRE_REDIS=true`
- [ ] Use managed Mongo replica set/cluster (not free/shared tier)
- [ ] Set `REQUIRE_MANAGED_MONGO=true`
- [ ] Configure object storage credentials (`CLOUDINARY_*`)
- [ ] Set `FORCE_OBJECT_STORAGE=true`
- [ ] Rotate secrets/credentials:
  - [ ] `JWT_SECRET`
  - [ ] Mongo database user/password
  - [ ] Cloudinary API key/secret

### Validation
- Commands:
  - `npm run smoke:predeploy`
  - `npm run check:day1`
- Exit criteria:
  - [ ] All app nodes report `ready` through `/health/ready`
  - [ ] Redis check passes with `REQUIRE_REDIS=true`
  - [ ] Mongo check passes and replica set is detected
  - [ ] Uploads use object storage in production and do not fall back to local disk

---

## Day 2 - Observability and SLO Baseline (Closed)

### Scope
- Define SLOs and expose measurable operational metrics
- Create alert policy template
- Capture baseline report snapshots

### Implemented
- `/health/ops` operational metrics endpoint including:
  - request totals
  - status code distribution
  - rolling p50/p95/p99
  - dependency status (Mongo, Redis adapter)
  - socket metrics (`connected`, `disconnected`, `authErrors`, `eventErrors`, `throttled`, `currentlyConnected`, `activeSessionCount`)
  - `socketEngine.connectionErrors`
- **`GET /metrics`** — Prometheus text exposition (same signals as `/health/ops`) for scrape + Grafana
- `npm run check:day2` baseline capture command (appends snapshots to this file)
- **`npm run check:day2:synthetic`** — light traffic against `/health`, `/health/ready`, and `/metrics` (all 2xx when healthy); prints `/health/ops` counter deltas
- **`npm run check:day2:alerts`** — evaluates current `/health/ops` against suggested thresholds (exit 1 on critical; set `REQUIRE_REDIS=true` to enforce adapter rule)
- **`monitoring/prometheus/lms-alert-rules.example.yml`** — import into Prometheus as a starting point (tune `for` / thresholds)
- **`monitoring/grafana/lms-health-overview.json`** — import into Grafana; assign your Prometheus datasource on each panel if prompted
- Alert policy template and SLO notes integrated below

### Day 2 Verification Commands
- `npm run dev`
- `npm run check:day2`
- Optional custom sampling:
  - `HEALTH_OPS_URL=http://localhost:5000/health/ops DAY2_SAMPLE_COUNT=10 DAY2_SAMPLE_INTERVAL_MS=1000 npm run check:day2`
- Synthetic + dry-run:
  - `npm run check:day2:synthetic`
  - `npm run check:day2:alerts`
- Prometheus: scrape `http://<instance>:<port>/metrics` (or LB with per-target scrape)
- Local stack: `monitoring/docker-compose.observability.yml` — `npm run obs:up` (API on host **5000**). URLs: Prometheus **9090**, Grafana **3100** (`GF_SERVER_ROOT_URL`), Alertmanager **9093**. Grafana **`grafana-data`** volume keeps UI state across restarts. Stop: `npm run obs:down`
- **Validated locally:** Prometheus targets **UP**; Grafana **LMS** dashboard; Prometheus **alert rules** loaded; **Grafana → Slack** contact point test (Silence links use port 3100). Optional: replace `api_url` placeholder in `monitoring/alertmanager/alertmanager.dev.yml` with a rotated webhook to prove **Prometheus → Alertmanager → Slack** (do not commit secrets)

### Suggested Alert Thresholds
- API p95 latency > 400ms for 10 minutes
- API p99 latency > 1200ms for 10 minutes
- 5xx rate > 1% for 5 minutes
- Redis adapter disabled in production for > 2 minutes
- Mongo disconnected for > 30 seconds

### Alert Policy Template

#### Service-level alerts
- API p95 latency
  - Condition: `p95 > 400ms` for 10 minutes
  - Severity: High
  - Route: Backend on-call
  - Source: `/health/ops -> requestMetrics.latencyMs.p95`
- API p99 latency
  - Condition: `p99 > 1200ms` for 10 minutes
  - Severity: High
  - Route: Backend on-call + incident channel
  - Source: `/health/ops -> requestMetrics.latencyMs.p99`
- 5xx error rate
  - Condition: `status5xx / total > 1%` for 5 minutes
  - Severity: Critical
  - Route: Backend on-call + incident channel + SMS
  - Source: `/health/ops -> requestMetrics`

#### Dependency alerts
- Mongo disconnected
  - Condition: `mongoConnected=false` for 30 seconds
  - Severity: Critical
  - Route: Platform + backend on-call
  - Source: `/health/ops -> dependencies.mongoConnected`
- Redis adapter unavailable (production)
  - Condition: `redisAdapterEnabled=false` for 2 minutes with `REQUIRE_REDIS=true`
  - Severity: High
  - Route: Platform + backend on-call
  - Source: `/health/ops -> dependencies.redisAdapterEnabled`

#### Realtime alerts
- Socket event error spike
  - Condition: `eventErrors` increases rapidly over 5-minute window
  - Severity: Medium
  - Route: Backend on-call
  - Source: `/health/ops -> socketMetrics.eventErrors`
- Disconnect surge
  - Condition: `disconnected/connected ratio` exceeds threshold over 5 minutes
  - Severity: Medium
  - Route: Backend on-call
  - Source: `/health/ops -> socketMetrics`

#### Operational notes
- Add 10-minute cooldown to reduce alert noise
- Use alert dedup keys by service + condition
- Include runbook link in alert payload

#### Escalation routing (configure in your platform)
Wire each severity to the correct destination (examples — replace with your tooling):

| Severity | Typical route |
|----------|----------------|
| Critical | PagerDuty / Opsgenie high-urgency + Slack `#incidents` |
| High | Backend on-call rotation + Slack `#backend-alerts` |
| Warning | Slack `#observability` (business hours) or email digest |

**Test alerts:** In Grafana Alerting or Datadog, create a synthetic metric condition you can toggle (or temporarily lower a threshold in a staging workspace), fire once, confirm receipt and ack flow, then restore thresholds.

### Baseline Report Entries

#### Capture 2026-04-27T16:29:09.964Z
- Source: `http://localhost:5000/health/ops`
- Samples: 5
- IntervalMs: 2000

```json
{
  "status": "ok",
  "uptimeSeconds": 23,
  "requestMetrics": {
    "total": 4,
    "status2xx": 4,
    "status4xx": 0,
    "status5xx": 0,
    "errorRatePercent": 0,
    "latencyMs": {
      "p50": 2.95,
      "p95": 11.26,
      "p99": 11.26
    }
  },
  "dependencies": {
    "mongoConnected": true,
    "redisAdapterEnabled": false,
    "redisAdapterError": null
  },
  "socketMetrics": {
    "connected": 0,
    "disconnected": 0,
    "authErrors": 0,
    "eventErrors": 0,
    "currentlyConnected": 0,
    "activeSessionCount": 0
  }
}
```

### Day 2 closure (repo + local validation)
- Dashboard: provisioned from `monitoring/grafana/provisioning/dashboards/json/lms-health-overview.json` (folder **LMS** in Grafana).
- Alert rules: `monitoring/prometheus/lms-alert-rules.example.yml` mounted as Prometheus rules; tune `for` / thresholds for prod.
- Synthetic + dry-run: `npm run check:day2:synthetic`, `npm run check:day2:alerts` (5xx-only critical path).
- **Slack:** Grafana contact point **Test** delivered to Slack; optional full path via Alertmanager `slack_configs` in `monitoring/alertmanager/alertmanager.dev.yml` after rotating any leaked webhook.
- Production: mirror scrape + rules + notification routes on real hostnames/LB; do not rely on `localhost` or committed webhooks.

---

## Day 3 - Performance Hotspots (Planned)
- [x] Add Redis-backed caching for hot read endpoints (grades + inbox)
- [x] Remove high-cost N+1 in class-average calculation by preloading submissions/groups
- [x] Add load benchmark checkpoint for optimized endpoints and capture p95 delta
- [x] Tune cache TTL defaults based on Day 3 benchmark behavior
- [x] Re-run Day 3 benchmark with `REDIS_URL` enabled to validate warm-cache gains in production-like mode

### Day 3 Implemented Now
- Added cache utility:
  - `utils/cache.js`
- Added endpoint caching:
  - `controllers/inbox.controller.js` (`getConversations`, `getMessages`)
  - `controllers/grades.controller.js` (`getStudentCourseGrade`, `getCourseClassAverage`)
- Optimized class average query strategy:
  - single preloads for regular submissions, group membership, group submissions
  - removed per-student/per-assignment DB fetch loops in `getCourseClassAverage`
- Tuned default cache TTLs:
  - inbox conversations: 60s
  - inbox messages: 20s
  - student grade: 60s
  - course class average: 45s

### Day 3 Benchmark Notes
- Redis-enabled rerun completed and appended below.
- Runtime for rerun:
  - Requests per phase: 12
  - Request delay: 600ms
- p95 results from Redis-enabled rerun:
  - Inbox conversations improved by 15.83ms (94.10 -> 78.27)
  - Inbox messages regressed by 3.96ms (67.20 -> 71.16)
  - Student course grade regressed by 790.85ms (162.83 -> 953.68)
  - Course class average improved by 13.74ms (198.22 -> 184.48)
- Grade endpoint tuning follow-up completed:
  - Optimized `getStudentCourseGrade` to scope group assignments by course `GroupSet` (indexed) instead of scanning/filtering all group assignments.
  - Added lean query usage on hot query paths in the student-grade endpoint.
- Validation rerun after tuning:
  - Student course grade improved by 231.61ms (431.61 -> 200.00)
  - Inbox conversations improved by 42.74ms (127.83 -> 85.09)
  - Inbox messages improved by 0.67ms (67.41 -> 66.74)
  - Course class average regressed by 131.46ms (196.68 -> 328.14)
- Class-average tuning follow-up completed:
  - Optimized `getCourseClassAverage` to scope group assignments by course `GroupSet` (indexed) rather than global scan/filter.
  - Added `lean()` on hot queries and precomputed discussion grade lookups to reduce repeated per-student scanning.
- Validation rerun after class-average tuning:
  - Inbox conversations improved by 33.07ms (139.96 -> 106.89)
  - Inbox messages improved by 1.56ms (81.54 -> 79.98)
  - Student course grade improved by 78.98ms (266.96 -> 187.98)
  - Course class average near parity at -1.74ms (150.35 -> 152.09), likely benchmark noise at low sample count.
- Day 3 status: complete for week progression; increase `DAY3_BENCH_REQUESTS` during Day 5 load phase for higher-confidence percentile stability. **`DAY3_INTER_ENDPOINT_PAUSE_MS`** (default 12s in `scripts/day3EndpointBenchmark.js`) avoids **429** when chaining inbox + grades under the write limiter.

## Day 4 - Realtime and Backpressure (Closed)

### Scope
- Multi-instance Socket.IO (Redis adapter) healthy in production
- Backpressure on abusive QuizWave clients (per-socket throttles)
- Observable engine failures (handshake / transport errors)

### Implemented in code
- Per-socket sliding-window throttles on all QuizWave inbound events (`utils/quizwaveSocketThrottle.js`, wired in `socket/quizwave.socket.js`); overload responses use `quizwave:error` with `code: 'rate_limited'`; metric `socketMetrics.throttled` on `/health/ops`
- Socket.IO engine tuning: `connectTimeout`, `pingTimeout`, `pingInterval`, `maxHttpBufferSize`, `transports` (env-driven in `server.js`)
- Engine `connection_error` counter exposed as `socketEngine.connectionErrors` on `/health/ops`
- `npm run check:day4` — fetches `/health/ops` for each URL in `APP_HEALTH_URLS` or `DAY4_HEALTH_URLS` (default `http://localhost:5000`); warns if local `.env` has `REDIS_URL` but the target server reports adapter off; set `DAY4_REQUIRE_REDIS_ADAPTER=true` to fail CI on that mismatch
- Local two-process smoke: `npm run dev` (port from `PORT`, default 5000) plus `npm run dev:peer` (`PEER_PORT` / default 5001 via `scripts/startPeerServer.js`), then `npm run check:day4:pair` to hit both `/health/ops` URLs; keep `REDIS_URL` in `.env` so both pick up Redis without per-shell env vars

### Operational validation (production or staging)
- [x] Local: two Node processes (`npm run dev` + `npm run dev:peer`) with shared `REDIS_URL`; `npm run check:day4:pair` shows `redisAdapterEnabled: true` on both ports
- [ ] Production: at least two app instances behind LB with the same `REDIS_URL`; confirm `redisAdapterEnabled: true` on `/health/ops` for each instance URL
- [ ] Production: QuizWave host on node A, student client on node B, confirm broadcasts (e.g. `quizwave:question-started`) arrive
- [ ] Optional: synthetic socket spam — rapid `quizwave:answer` should yield `rate_limited` without DB load spikes; watch `socketMetrics.throttled` on `/health/ops` or `/metrics`

### Exit criteria
- [x] Redis adapter on whenever `REDIS_URL` is set and Redis is reachable (verified locally; repeat per env after deploy)
- [x] Throttles active with tunable caps (`QUIZWAVE_THROTTLE_*` in `.env.example`)
- [x] `check:day4` / `check:day4:pair` green for configured instance URLs; optional `DAY4_REQUIRE_REDIS_ADAPTER=true` in CI after Redis is guaranteed

### Day 4 closure (repo)
Local multi-process validation passed (`check:day4:pair`). Remaining items are **production-only** (LB URLs, real QuizWave across nodes, optional spam test). Prometheus `/metrics` from Day 2 covers `lms_socket_*` and adapter gauges for dashboards.

## Day 5 - Load Test Round 1 (In progress)

### Scope
- Controlled ramp of concurrent traffic, observe latency/error signals (`/health/ops`, Prometheus), fix first bottlenecks.
- Prefer staging or a dedicated load env; default script hits **read-only** paths only.

### Implemented in repo
- **`scripts/day5LoadRamp.js`** — public path ramp (default) **or** `DAY5_MODE=api` for JWT routes (inbox, grades, messages when DB has data). Shared DB/JWT helpers in **`scripts/lib/loadTestContext.js`** (also used by **`scripts/day3EndpointBenchmark.js`**).
- **`npm run check:day5`** — public read paths; **`npm run check:day5:api`** — API mode (needs `MONGODB_URI` + API up; uses smaller default concurrency + `DAY5_API_GAP_MS` to reduce 429s).
- Tune `DAY5_*` / `DAY5_API_*` in `.env.example` or shell.

### How to run (local)
1. `npm run dev` (API **5000**). Optional: `npm run obs:up` to watch Grafana/Prometheus during the ramp.
2. **Public ramp:** `npm run check:day5`. Heavier:  
   `$env:DAY5_MAX_CONCURRENCY="40"; $env:DAY5_PHASE_DURATION_MS="20000"; npm run check:day5`
3. **API ramp (hot routes):** `npm run check:day5:api` — optional `$env:DAY5_API_MAX="6"; $env:DAY5_API_GAP_MS="350"` if you see many 429s.
4. Read appended **Day 5 load ramp** / **Day 5 API load ramp** blocks below; capture `/health/ops` + Grafana when something degrades; open a fix ticket (bottleneck cycle).

### Exit criteria (round 1)
- [x] At least one ramp run recorded in this file with acceptable server p95 / zero 5xx under agreed concurrency envelope (read-only paths; conc 2→24; **0** client errors; `/health/ops` after: **0** 5xx, mongo + redis adapter up; see latest **Day 5 load ramp** block below)
- [x] Top bottleneck documented for **authenticated / DB-heavy** routes — **`npm run check:day5:api`** run **2026-04-28** (see **Day 5 API load ramp** table below). **Summary:** four targets (inbox list, inbox messages, student course grades, course average); **0** client errors; **429** dominates as concurrency rises (rate limiting doing its job, not DB timeouts). Worst client p95 in-table was **184 ms** at conc=1 (likely cold/warm paths); at higher conc many requests are throttled so p95 drops. Post-ramp **`/health/ops`**: **0** 5xx, mongo connected, redis adapter on. **Next:** for “true” latency envelopes under auth, either widen limits on a **dedicated load env** or use gentler **`DAY5_API_GAP_MS`** / lower **`DAY5_API_MAX`** and longer phases; re-run **`check:day3`** with higher `DAY3_BENCH_REQUESTS` for per-route p95 without hammering 429.
- [x] Re-run after fixes to confirm regression window — **`npm run check:day5:api`** re-run **2026-04-28** (table at **2026-04-28T14:12:43.351Z**): still **0** client errors + **0** 5xx; 429s materially improved at conc 3..5 vs earlier run (3/28/11 vs 36/48/50), with usable p95 around **42-56ms** before hard throttling at conc 6+.

## Day 6 - Load Test Round 2 Soak (Planned)
- [ ] 12-24h soak with failure injection
- [x] 60-minute API soak completed (`DAY5_API_MAX=5`, `DAY5_API_GAP_MS=250`, `DAY5_API_PHASE_MS=720000`; see block `2026-04-28T15:34:00.223Z`). Service stayed up with **0** 5xx and low server p95, but app-level saturation appears from conc>=3 (errors + 429 climb sharply). Recommended steady envelope for auth routes: `DAY5_API_MAX=2` (or `3` only for short bursts) and `DAY5_API_GAP_MS=300`.
- [x] Confirmatory run at safer envelope passed (`DAY5_API_MAX=2`, `DAY5_API_GAP_MS=300`, `DAY5_API_PHASE_MS=180000`; block `2026-04-28T15:51:21.919Z`): **0** client errors, low 429 at conc=2 (52/964), **0** 5xx after run, mongo + redis adapter healthy.

## Day 7 - Go/No-Go (Planned)
- [x] Final capacity envelope and release decision (drafted)

### Go/No-Go Decision Draft (2026-04-28)

- **Recommendation:** **Conditional GO** for controlled rollout using validated auth-route envelope; treat this as production-candidate, not full-scale open throttle.
- **Validated steady envelope (auth/JWT routes):** run around `DAY5_API_MAX=2`, `DAY5_API_GAP_MS=300` (confirmatory run `2026-04-28T15:51:21.919Z`: 0 client errors, 0 server 5xx, mongo + redis adapter healthy).
- **Known limit:** sustained conc>=3 under current policy shows sharp 429/error growth in soak (`2026-04-28T15:34:00.223Z`), so keep higher concurrency for short stress windows only.
- **Go blockers still open before production cutover:** Day 1 operational checklist items (real LB/multi-node wiring, managed Redis + managed Mongo enforcement, object-storage-only enforcement, secrets rotation) and the Day 6 failure-injection item.
- **Rollback + ownership:** rollback is to last stable deploy with current rate-limit policy; on-call owner must be named at release handoff.

### Release Gate Checklist (must be green for final GO)

- [ ] Day 1 production checklist complete in target environment.
- [ ] Day 6 failure injection executed and recovery time documented.
- [ ] Grafana + alert routing verified during pre-release window.
- [ ] Rollback command/playbook validated and on-call owner assigned.



#### Capture 2026-04-27T16:35:59.981Z

- Source: http://localhost:5000/health/ops
- Samples: 5
- IntervalMs: 2000

### Latest Snapshot

```json
{
  "status": "ok",
  "uptimeSeconds": 11,
  "requestMetrics": {
    "total": 4,
    "status2xx": 4,
    "status4xx": 0,
    "status5xx": 0,
    "errorRatePercent": 0,
    "latencyMs": {
      "p50": 1.37,
      "p95": 4.32,
      "p99": 4.32
    }
  },
  "dependencies": {
    "mongoConnected": true,
    "redisAdapterEnabled": false,
    "redisAdapterError": null
  },
  "socketMetrics": {
    "connected": 0,
    "disconnected": 0,
    "authErrors": 0,
    "eventErrors": 0,
    "currentlyConnected": 0,
    "activeSessionCount": 0
  }
}
```


### Day 3 Benchmark 2026-04-27T16:42:59.689Z

- Base URL: http://localhost:5000
- Requests per phase: 12

| Endpoint | Cold p95 (ms) | Warm p95 (ms) | Improvement (ms) |
| --- | ---:| ---:| ---:|
| Inbox conversations | 116.01 | 235.68 | -119.67 |
| Inbox messages | 55.71 | 57.71 | -2 |
| Student course grade | 172.9 | 146.74 | 26.16 |
| Course class average | 152.54 | 133.88 | 18.66 |


### Day 3 Benchmark 2026-04-27T16:51:12.422Z

- Base URL: http://localhost:5000
- Requests per phase: 12

| Endpoint | Cold p95 (ms) | Warm p95 (ms) | Improvement (ms) |
| --- | ---:| ---:| ---:|
| Inbox conversations | 148.83 | 251.62 | -102.79 |
| Inbox messages | 63.69 | 70.85 | -7.16 |
| Student course grade | 180.66 | 158.67 | 21.99 |
| Course class average | 366.18 | 156.31 | 209.87 |


### Day 3 Benchmark 2026-04-27T16:55:12.646Z

- Base URL: http://localhost:5000
- Requests per phase: 12
- Request delay: 600ms

| Endpoint | Cold p95 (ms) | Warm p95 (ms) | Improvement (ms) |
| --- | ---:| ---:| ---:|
| Inbox conversations | 94.1 | 78.27 | 15.83 |
| Inbox messages | 67.2 | 71.16 | -3.96 |
| Student course grade | 162.83 | 953.68 | -790.85 |
| Course class average | 198.22 | 184.48 | 13.74 |


### Day 3 Benchmark 2026-04-27T16:58:48.001Z

- Base URL: http://localhost:5000
- Requests per phase: 12
- Request delay: 600ms

| Endpoint | Cold p95 (ms) | Warm p95 (ms) | Improvement (ms) |
| --- | ---:| ---:| ---:|
| Inbox conversations | 127.83 | 85.09 | 42.74 |
| Inbox messages | 67.41 | 66.74 | 0.67 |
| Student course grade | 431.61 | 200 | 231.61 |
| Course class average | 196.68 | 328.14 | -131.46 |


### Day 3 Benchmark 2026-04-27T17:02:03.041Z

- Base URL: http://localhost:5000
- Requests per phase: 12
- Request delay: 600ms

| Endpoint | Cold p95 (ms) | Warm p95 (ms) | Improvement (ms) |
| --- | ---:| ---:| ---:|
| Inbox conversations | 139.96 | 106.89 | 33.07 |
| Inbox messages | 81.54 | 79.98 | 1.56 |
| Student course grade | 266.96 | 187.98 | 78.98 |
| Course class average | 150.35 | 152.09 | -1.74 |


### Day 5 API load ramp 2026-04-28T01:31:29.439Z

- Base: http://localhost:5000
- Mode: api (JWT routes)
- Phase: 12000ms; concurrency 1..8 step 1; gap 200ms

| Concurrency | Requests | Errors | 429 | Client p95 (ms) |
| --- | ---:| ---:| ---:| ---:|
| 1 | 50 | 0 | 0 | 184 |
| 2 | 78 | 0 | 8 | 30 |
| 3 | 36 | 0 | 36 | 13 |
| 4 | 48 | 0 | 48 | 8 |
| 5 | 90 | 0 | 50 | 83 |
| 6 | 134 | 0 | 54 | 38 |
| 7 | 84 | 0 | 84 | 10 |
| 8 | 96 | 0 | 96 | 10 |

- After ramp — /health/ops: total=635, 5xx=0, server p95=27.58ms, mongo=true, redisAdapter=true


### Day 3 Benchmark 2026-04-28T01:39:38.797Z

- Base URL: http://localhost:5000
- Requests per phase: 35
- Request delay: 450ms
- Inter-endpoint pause: 12000ms

| Endpoint | Cold p95 (ms) | Warm p95 (ms) | Improvement (ms) |
| --- | ---:| ---:| ---:|
| Inbox conversations | 48.69 | 33.6 | 15.09 |
| Inbox messages | 53.47 | 51.51 | 1.96 |
| Student course grade | 34.5 | 35.37 | -0.87 |
| Course class average | 37.94 | 28.02 | 9.92 |


### Day 5 API load ramp 2026-04-28T14:12:43.351Z

- Base: http://localhost:5000
- Mode: api (JWT routes)
- Phase: 12000ms; concurrency 1..8 step 1; gap 200ms

| Concurrency | Requests | Errors | 429 | Client p95 (ms) |
| --- | ---:| ---:| ---:| ---:|
| 1 | 48 | 0 | 0 | 195 |
| 2 | 102 | 0 | 0 | 49 |
| 3 | 151 | 0 | 3 | 42 |
| 4 | 114 | 0 | 28 | 48 |
| 5 | 225 | 0 | 11 | 56 |
| 6 | 72 | 0 | 72 | 9 |
| 7 | 84 | 0 | 84 | 20 |
| 8 | 96 | 0 | 96 | 13 |

- After ramp — /health/ops: total=1147, 5xx=0, server p95=46.62ms, mongo=true, redisAdapter=true


### Day 5 API load ramp 2026-04-28T15:34:00.223Z

- Base: http://localhost:5000
- Mode: api (JWT routes)
- Phase: 720000ms; concurrency 1..5 step 1; gap 250ms

| Concurrency | Requests | Errors | 429 | Client p95 (ms) |
| --- | ---:| ---:| ---:| ---:|
| 1 | 2494 | 0 | 3 | 59 |
| 2 | 3805 | 0 | 442 | 50 |
| 3 | 4616 | 1788 | 1123 | 39 |
| 4 | 5386 | 3578 | 1808 | 12 |
| 5 | 6071 | 3594 | 2477 | 15 |

- After ramp — /health/ops: total=23322, 5xx=0, server p95=3.87ms, mongo=true, redisAdapter=true

#### Day 6 soak conclusion (2026-04-28)

- **Outcome:** infra stayed healthy (no 5xx), but this envelope is too aggressive for sustained auth-route load because 429 + app errors spike at conc 3..5.
- **Pass/fail:** partial pass (stability pass, throughput envelope fail at configured max).
- **Next config for soak/failure-injection runs:** `DAY5_API_MAX=2`, `DAY5_API_GAP_MS=300`, keep long phase duration; reserve `DAY5_API_MAX=3` for short stress windows only.


### Day 5 API load ramp 2026-04-28T15:51:21.919Z

- Base: http://localhost:5000
- Mode: api (JWT routes)
- Phase: 180000ms; concurrency 1..2 step 1; gap 300ms

| Concurrency | Requests | Errors | 429 | Client p95 (ms) |
| --- | ---:| ---:| ---:| ---:|
| 1 | 538 | 0 | 0 | 48 |
| 2 | 964 | 0 | 52 | 36 |

- After ramp — /health/ops: total=24931, 5xx=0, server p95=34.37ms, mongo=true, redisAdapter=true



#### Capture 2026-04-29T17:30:58.150Z

- Source: http://localhost:5000/health/ops
- Samples: 5
- IntervalMs: 2000

### Latest Snapshot

```json
{
  "status": "ok",
  "uptimeSeconds": 78,
  "requestMetrics": {
    "total": 6,
    "status2xx": 6,
    "status4xx": 0,
    "status5xx": 0,
    "errorRatePercent": 0,
    "latencyMs": {
      "p50": 8.15,
      "p95": 125.98,
      "p99": 125.98
    }
  },
  "dependencies": {
    "mongoConnected": true,
    "redisAdapterEnabled": false,
    "redisAdapterError": "Connection is closed."
  },
  "socketEngine": {
    "connectionErrors": 0
  },
  "socketMetrics": {
    "connected": 0,
    "disconnected": 0,
    "authErrors": 0,
    "eventErrors": 0,
    "throttled": 0,
    "currentlyConnected": 0,
    "activeSessionCount": 0
  }
}
```


### Day 3 Benchmark 2026-04-29T17:32:24.505Z

- Base URL: http://localhost:5000
- Requests per phase: 12
- Request delay: 350ms
- Inter-endpoint pause: 12000ms

| Endpoint | Cold p95 (ms) | Warm p95 (ms) | Improvement (ms) |
| --- | ---:| ---:| ---:|
| Inbox conversations | 125.8 | 36.73 | 89.07 |
| Inbox messages | 95.95 | 109.73 | -13.78 |
| Student course grade | 298.83 | 188.99 | 109.84 |
| Course class average | 163.63 | 203.76 | -40.13 |


### Day 5 load ramp 2026-04-29T17:35:38.120Z

- Base: http://localhost:5000
- Paths: /health, /health/ready, /metrics
- Phase duration: 15000ms; concurrency 2..24 step 2

| Concurrency | Requests | Errors | Client p95 (ms) |
| --- | ---:| ---:| ---:|
| 2 | 1654 | 0 | 10 |
| 4 | 751 | 0 | 287 |
| 6 | 4764 | 0 | 23 |
| 8 | 5334 | 0 | 30 |
| 10 | 2747 | 0 | 148 |
| 12 | 325 | 0 | 1404 |
| 14 | 1313 | 0 | 600 |
| 16 | 3736 | 0 | 130 |
| 18 | 12880 | 0 | 29 |
| 20 | 13552 | 0 | 29 |
| 22 | 12728 | 0 | 38 |
| 24 | 13923 | 0 | 31 |

- After ramp — /health/ops: total=74003, 5xx=0, server p95=1.85ms, mongo=true, redisAdapter=false


### Day 5 API load ramp 2026-04-29T17:37:24.647Z

- Base: http://localhost:5000
- Mode: api (JWT routes)
- Phase: 12000ms; concurrency 1..8 step 1; gap 200ms

| Concurrency | Requests | Errors | 429 | Client p95 (ms) |
| --- | ---:| ---:| ---:| ---:|
| 1 | 41 | 0 | 0 | 149 |
| 2 | 80 | 0 | 0 | 166 |
| 3 | 119 | 0 | 0 | 187 |
| 4 | 125 | 0 | 20 | 156 |
| 5 | 60 | 0 | 60 | 8 |
| 6 | 85 | 0 | 66 | 312 |
| 7 | 203 | 0 | 0 | 531 |
| 8 | 147 | 0 | 72 | 473 |

- After ramp — /health/ops: total=74893, 5xx=0, server p95=427.82ms, mongo=true, redisAdapter=false

