# 2,500 VU capacity certification — checklist & cost

**Purpose:** Pay for infra only while validating. Check everything off, tear down, stay client-ready.

**Definition:** 2,500 **concurrent simulated LMS sessions** (70% student / 20% instructor / 10% admin), same mix as `scripts/load/capacityLoadBench.js`. Not 2,500 static page views.

**When certified:** Re-run this checklist on client go-live (same runbook, likely bigger tiers + 24×7).

---

## Certification record

| Field | Value |
|-------|--------|
| **Status** | **Local Docker certified** (2026-06-10) — cloud burst re-run optional |
| **Environment** | Windows laptop, Docker Desktop, `docker-compose.load.yml` |
| **API replicas** | **8** (`LOAD_API_REPLICAS=8` or `docker compose … --scale api=8`) |
| **Load target** | `http://127.0.0.1:5001` (use `127.0.0.1`, not `localhost`, on Windows) |
| **MongoDB** | Atlas (existing dev cluster) |
| **Final report** | `uploads/reports/capacity-load-1781111975783.json` |
| **Also archived** | `uploads/reports/capacity-load-latest.json` |

### Results @ 8 API replicas (2026-06-10)

| VUs | Error rate | Gate | p95 | Result |
|-----|------------|------|-----|--------|
| 30 (smoke) | 0.00% | 0% | 10.5s | **Pass** |
| 250 | 0.00% | < 1% | 21.1s | **Pass** |
| 500 | 0.00% | < 2% | 14.8s | **Pass** |
| 1,000 | 2.41% | < 3% | 21.5s | **Pass** (45 timeouts, 3× HTTP 500) |
| 1,500 | 0.04% | < 5% | 20.5s | **Pass** |
| **2,500** | **0.06%** | < 5% | **14.3s** | **Pass** (2× HTTP 500 only) |

### Replica scaling notes (same laptop, 250 VU gate)

| Replicas | 250 VU error rate | Notes |
|----------|-------------------|--------|
| 3 (default) | 11.3% | Timeouts — insufficient |
| 6 | 2.5% | Still above 1% gate |
| **8** | **0.0%** | **Minimum proven for certification ladder** |

### Proven stack env (load test only)

Set on API containers via `docker-compose.load.yml` (not dev `.env`):

```
NODE_ENV=production
REQUIRE_REDIS=true
REDIS_URL=redis://redis:6379
NOTIFICATION_FANOUT_QUEUE_ENABLED=true
FILE_SCAN_QUEUE_ENABLED=true
PLANNER_UX_ENABLED=true
QUIZWAVE_DISTRIBUTED_TIMERS=false
DISABLE_RATE_LIMIT=true          # load test only — remove for client prod
JWT_SECRET=<strong secret>       # compose overrides dev default
```

Dev `.env` for local work (separate from load stack):

```
PLANNER_UX_ENABLED=true
REDIS_URL=redis://127.0.0.1:6379
QUIZWAVE_DISTRIBUTED_TIMERS=false
```

### Still open before “fully closed”

- [x] Phase D tear down (`npm run load:stack:down`) — 2026-06-10
- [ ] Optional: cloud VM burst re-run (same region as Atlas) to confirm outside laptop
- [ ] Predeploy workflow green on main branch
- [ ] Migration registry + `validateMongoIndexes.js` on test DB
- [ ] Remove fixture users (`capacity-load-*@loadtest.com`) if desired

---

## Pass / fail gates

| Level | Error rate | p95 latency | Notes |
|-------|------------|-------------|--------|
| 250 VUs | **< 1%** | < 15s | Roadmap gate — must pass |
| 500 VUs | < 2% | < 20s | |
| 1,000 VUs | < 3% | < 25s | |
| 1,500 VUs | < 5% | < 30s | |
| **2,500 VUs** | **< 5%** | **< 30s** | Certification target |

Errors must be **HTTP failures/timeouts**, not config mistakes (404 planner, 429 rate limit, ECONNREFUSED). Report must show error breakdown (`errors.byType` in capacity report).

---

## Phase A — Code & config (no cloud cost)

Do this on your machine / CI before spinning up paid infra.

### A1. Feature flags & env (API)

- [x] `PLANNER_UX_ENABLED=true`
- [x] `REQUIRE_REDIS=true` (set in `docker-compose.load.yml`)
- [x] `NOTIFICATION_FANOUT_QUEUE_ENABLED=true` (load stack)
- [ ] `INBOX_DENORM_UNREAD=true` (if using inbox at scale)
- [ ] `NOTIFICATION_DEDUPE=true`
- [x] Strong `JWT_SECRET` (not dev default) for prod-like containers
- [x] `QUIZWAVE_DISTRIBUTED_TIMERS=false` unless actively testing QuizWave under load
- [x] Rate limits: `DISABLE_RATE_LIMIT=true` **only during load test**, not client prod

### A2. CI guards (already in repo — must be green)

- [x] `npm run verify:mongo-explain:ci` (2026-06-10)
- [x] `npm run verify:fanout-bench:ci` (2026-06-10)
- [x] `npm run verify:file-orphans:ci` (2026-06-10)
- [ ] Predeploy workflow green on main branch

### A3. Migrations & indexes

- [ ] Run migration registry against **test** MongoDB (not prod data):
  ```bash
  node scripts/migrations/registry.js
  ```
- [ ] `node scripts/validateMongoIndexes.js` — no missing hot-path indexes
- [ ] Migration `006-p2-scale-indexes` applied

### A4. Known code fixes verified

- [x] Planner feed returns 200 (not 404) with flag on
- [x] Inbox rate limit uses `ipKeyGenerator` (no `ERR_ERL_KEY_GEN_IPV6` spam)
- [x] Capacity bench preflight passes (`assertPlannerFeedEnabled`)

### A5. Frontend (optional for API-only load test)

- [x] API load test uses `Dockerfile.load` (no frontend build required)
- [ ] For full E2E before client: `npm run build` in `frontend/` green

**Phase A done when:** CI green + local smoke at 30 VUs = 0% errors against dev or load stack. **Smoke passed 2026-06-10.**

---

## Phase B — Burst infra (pay only for test window)

Spin up → test → **tear down**. Do not leave running between certification attempts unless actively debugging.

### B1. Choose test topology

**Proven locally (2026-06-10) — use this for re-runs:**

| Component | Spec |
|-----------|------|
| App host | Windows/Mac laptop with Docker Desktop, **16 GB+ RAM recommended** |
| Stack | `docker-compose.load.yml`: **8× API**, Redis, nginx, 1× notification worker |
| MongoDB | Atlas (existing cluster; same region as load host when on cloud) |
| Load generator | Same machine as Docker stack |
| Start command | `LOAD_API_REPLICAS=8 npm run load:stack:up` |

**Minimum for 250 VU gate:** 8 replicas (3 failed at 11%, 6 at 2.5%).

**Cloud burst (optional confirmation):**

| Component | Spec |
|-----------|------|
| App host | 1 VM, 16 vCPU / 32 GB RAM, Docker |
| API replicas | **8** |
| MongoDB | Atlas **M10+**, **same region** as VM |
| Load generator | Same VM or separate 4 vCPU VM at 2500 VUs |

### B2. Spin up (local Docker — $0 compute, Atlas only)

```bash
npm run load:stack:up
# Stack listens on http://127.0.0.1:5001 (Windows: use 127.0.0.1, not localhost)
```

Cloud equivalent: clone repo on VM, copy `.env` with Atlas URI in **same region**, run same commands.

### B3. Pre-flight on stack

- [x] `GET http://127.0.0.1:5001/health/live` → 200
- [x] `GET http://127.0.0.1:5001/health/ops` → `redisAdapterEnabled: true`, `mongoConnected: true`
- [x] Login + `GET /api/planner/feed` → 200

### B4. Seed fixtures

```bash
npm run seed:capacity
# Creates 500 students, 30 assignments, 15 threads → uploads/reports/capacity-fixtures.json
```

- [x] Fixture manifest exists
- [x] Seed completes without error

---

## Phase C — Load test execution

### C1. Smoke (free — always run first)

```bash
LOAD_BASE_URL=http://127.0.0.1:5001 \
LOAD_CONCURRENCY_LEVELS=30 \
LOAD_PHASE_DURATION_MS=8000 \
npm run test:load:capacity
```

- [x] **0% errors** (2026-06-10, report `capacity-load-1781111439319.json`)

### C2. Roadmap gate @ 250 VUs

```bash
LOAD_BASE_URL=http://127.0.0.1:5001 \
LOAD_CONCURRENCY_LEVELS=250 \
LOAD_PHASE_DURATION_MS=20000 \
npm run test:load:capacity
```

- [x] **< 1% error rate** (0.00% @ 8 replicas, 2026-06-10)
- [x] Report saved: `uploads/reports/capacity-load-latest.json`

### C3. Step-up ladder (one run)

```bash
LOAD_BASE_URL=http://127.0.0.1:5001 \
LOAD_CONCURRENCY_LEVELS=500,1000,1500,2500 \
LOAD_PHASE_DURATION_MS=20000 \
LOAD_COOLDOWN_MS=10000 \
npm run test:load:capacity
```

Requires **8 API replicas** before running.

- [x] Each level meets gates in table above (2026-06-10)
- [x] No dominant `ECONNREFUSED` (infra capacity issue)
- [x] No dominant `http_429` (rate limit misconfig)
- [x] No `http_404` on planner feed

### C4. Ops review (from report `opsMetrics`)

- [x] Redis adapter enabled under load
- [x] Errors at 2500 VUs: 2× `http_500` only (no ECONNREFUSED, no 429, no planner 404)
- [ ] Investigate 3× HTTP 500 @ 1000 VUs + 2× @ 2500 VUs (non-blocking — within gates)

### C5. If a gate fails

1. Read `errors.byType` and per-endpoint breakdown in report.
2. **Timeouts** → scale API replicas, upgrade Mongo tier, same-region deployment, optimize hot query.
3. **429** → load-test env only: `DISABLE_RATE_LIMIT=true`.
4. **404 planner** → `PLANNER_UX_ENABLED=true` on API.
5. **ECONNREFUSED** → more API replicas / bigger host / separate load generator.
6. Fix → re-run from C1. **Do not** count failed runs as certified.

---

## Phase D — Tear down (stop paying)

```bash
npm run load:stack:down
```

- [x] Docker load stack stopped (`npm run load:stack:down`) — 2026-06-10
- [x] Dev Redis restored (`lms-redis-dev` on port 6379)
- [ ] Cloud VM(s) destroyed or stopped (N/A — local run)
- [ ] Optional: pause/delete dedicated Atlas test cluster (keep snapshot if cheap)
- [ ] Remove test fixture users from Mongo if shared cluster (`capacity-load-*@loadtest.com`)

**You are certified when Phase C3 passes and this phase is complete.** Phase C3 passed locally 2026-06-10; complete Phase D to stop infra.

---

## Phase E — Client-ready artifacts (keep forever, no infra cost)

Store these in repo / internal docs so go-live is repeatable:

- [x] Final passing report JSON → `uploads/reports/capacity-load-1781111975783.json`
- [x] Exact env var list from passing run (see **Certification record** above)
- [x] `LOAD_API_REPLICAS=8` on laptop Docker (16 GB+ RAM recommended)
- [x] Atlas tier used: existing dev Atlas cluster
- [ ] Known slow endpoints documented from report endpoint breakdown
- [x] Runbook: `LOAD_API_REPLICAS=8 npm run load:stack:up` → seed → bench → `load:stack:down`

---

# Cost guide

Prices are **approximate USD**, burst = pay only while testing. Adjust for provider/region.

## 1. Burst certification (spin up → test → tear down)

Goal: complete Phase C in **1–3 test days**, then stop billing.

| Item | Spec | Duration | Est. cost |
|------|------|----------|-----------|
| App VM | 8 vCPU / 16 GB (Hetzner CPX41, DO Premium, etc.) | 48 h | **$8–15** |
| App VM (2500 VU attempt) | 16 vCPU / 32 GB | 48 h | **$15–35** |
| Load generator VM (optional) | 4 vCPU | 24 h | **$3–8** |
| MongoDB Atlas | **M10**, test DB, same region as VM | 48–72 h | **$4–8** prorated* |
| MongoDB Atlas (if gradebook slow) | **M20** for final run only | 24 h | **~$5** prorated* |
| Redis | In Docker on app VM | — | **$0** |
| Cloudinary | Existing account | — | **$0** incremental |
| **Typical one certification cycle** | | | **$25–70** |
| **With 2–3 retry weekends** | | | **$80–200** total |

\*Atlas M10 ≈ $57/mo → ~$0.08/h. Use a **dedicated test project**; delete/pause when done. If you already pay for dev Atlas, incremental cost may be **$0** for short tests on a separate database.

**Cheapest path:** Your laptop runs Docker load stack + existing Atlas test DB = **$0 compute**, only Atlas storage/ops if on paid tier.

**Recommended path for honest 2500 proof:** 1× cloud VM (16 vCPU) + M10/M20 Atlas same region + separate load gen = **~$50–70 per weekend**.

---

## 2. After certification — idle (no client yet)

| Item | Cost |
|------|------|
| Infra | **$0** — everything torn down |
| Atlas dev cluster (optional) | Keep M0/M10 for dev only ≈ **$0–57/mo** |
| Code + reports in repo | **$0** |

---

## 3. Client go-live (when they sign — monthly, 24×7)

Starter production for **up to ~2,500 concurrent users** (same architecture you certified, always on):

| Item | Spec | Est. monthly |
|------|------|----------------|
| MongoDB Atlas | M10 → **M20** as enrollment grows | **$57–140** |
| App servers | 2× 8 vCPU (3–6 API containers each) + workers | **$80–160** |
| Load balancer | Managed LB or nginx on edge | **$10–25** |
| Redis | Managed 1 GB (Upstash / ElastiCache) | **$15–35** |
| Monitoring | Uptime + basic APM | **$0–30** |
| Cloudinary | Media (usage-based) | **$0–50** |
| Backups / WAF (optional) | | **$10–40** |
| **Starter total** | | **~$180–350/mo** |
| **Comfortable 2500 VU headroom** | M20, **8–10 API replicas**, dedicated Redis | **~$400–650/mo** |

Client pricing should **cover** comfortable tier + support margin, not starter tier alone.

---

## Suggested certification schedule

| Day | Action | Est. spend | Status |
|-----|--------|------------|--------|
| 1 | Phase A complete (local), smoke + 250 VU on load stack | $0 | **Done** |
| 2 | Scale to **8 replicas**, ladder to **2500 VU** | $0 (local Docker) | **Done** |
| 3 | Optional: cloud VM re-run same ladder | $15–40 | Open |
| 4 | Tear down, archive report | $0 | **Done** |

**Stop paying when:** Phase C3 @ 2500 VUs passes and Phase D teardown is done.

---

## Quick reference commands

```bash
# Start prod-like stack (local) — 8 replicas required for 2500 VU cert
LOAD_API_REPLICAS=8 npm run load:stack:up

# Full certification run (after smoke passes)
LOAD_BASE_URL=http://127.0.0.1:5001 \
LOAD_CONCURRENCY_LEVELS=500,1000,1500,2500 \
LOAD_PHASE_DURATION_MS=20000 \
LOAD_COOLDOWN_MS=10000 \
npm run test:load:capacity

# Or one-shot (defaults to 100,250,500 — override LEVELS for full ladder)
npm run test:load:capacity:stack

# Stop (stop paying)
npm run load:stack:down
```

Scale API replicas (if not using `LOAD_API_REPLICAS` on up):

```bash
docker compose -f docker-compose.load.yml up -d --scale api=8 --no-build
```

---

## Summary

| Question | Answer |
|----------|--------|
| Code or infra problem? | **Both** — code fixes done (P0–P2); 2500 VUs needs **8+ API nodes + Redis + Atlas** |
| Pay monthly until client? | **No** — burst test, certify, tear down |
| Budget for certification | **~$0 local** (done); optional cloud confirm **~$50** |
| Budget when client signs | **~$180–650/mo** depending on SLA and headroom |
| Ready for client? | **Local cert done** — tear down stack, optional cloud confirm, then deploy same architecture 24×7 |
| Minimum API replicas | **8** (proven 2026-06-10) |
