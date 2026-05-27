# Backend Development Lifecycle

This runbook documents the intended backend process model for local development.

## Process Model

- `nodemon` is the only restart authority.
- `scripts/devServer.js` is a preflight supervisor: it acquires the dev lock, prepares port `5000`, starts `server.js`, and exits when the child exits.
- `server.js` does not restart itself. It logs startup phases, gates listening on Mongo/index/email startup, and exits on fatal startup failures.
- `scripts/stopDev.js` stops lingering backend `nodemon`, `devServer.js`, and `server.js` processes for this workspace, clears stale locks, and waits for the port to become bindable.

## Fresh Start

```powershell
npm run stop:dev
npm run dev
```

If the machine has many unrelated Node processes and the local dev state is badly wedged, the manual fallback is:

```powershell
taskkill /F /IM node.exe
npm run dev
```

Use the fallback only as a local developer recovery step. It kills frontend dev servers, test runners, and other Node tools.

## Diagnostics

```powershell
npm run verify:dev-lifecycle
```

The verifier is read-only. It reports:

- backend `nodemon`, `devServer.js`, and `server.js` process counts
- port `5000` listener PIDs
- dev lock owner and whether that owner is alive

A healthy backend dev session has at most one `nodemon`, one `devServer.js`, one `server.js`, one port listener, and a live lock owner while the server is running.

## API Startup And Workers

The API process no longer starts background cleanup schedulers by default. Run workers separately:

```powershell
npm run worker:quizwave-cleanup
npm run worker:timed-quiz-sweep
npm run worker:grading-jobs
```

For a single-process local experiment only, set `ENABLE_API_SCHEDULERS=true` before `npm run dev`.

## Health Checks

- `/health/live` confirms the process is alive.
- `/health/ready` confirms Mongo startup is complete and required dependencies are available.
- `/health/ops` exposes startup phase, scheduler mode, Mongo state, Redis adapter state, and request/socket counters.

Redis adapter failures are degraded mode, not fatal, unless production requires Redis through environment policy.
