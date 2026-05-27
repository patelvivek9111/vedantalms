# Discussion E2E and Accessibility Certification

Phase E certifies the discussion system from the browser and user-workflow perspective. It validates existing discussion architecture and UI behavior without adding notifications, websockets, realtime collaboration, or redesigning the UI.

## Tooling

- Playwright browser automation.
- `@axe-core/playwright` automated accessibility checks.
- Chromium, Firefox, WebKit, and mobile Chrome Playwright projects.
- Deterministic API interception for discussion certification flows.
- Plain-editor E2E fallback activated by `localStorage['lms:e2e:plain-editor'] = '1'` to avoid TinyMCE cloud-origin overlays in local browser tests.

## Browser Matrix

- Chrome/Chromium: certified with Playwright `chromium`.
- Firefox: certified with Playwright `firefox`.
- Safari engine: certified with Playwright `webkit`.
- Mobile Chrome: certified with Playwright `Pixel 5` profile.
- Edge: certified with Playwright `msedge` channel when `E2E_INCLUDE_EDGE=1`.
- Native Safari: not available on Windows; WebKit is the local engine substitute.

## E2E Workflow Matrix

Covered by `e2e/specs/discussion-e2e-accessibility.spec.ts`:

- Student discussion participation.
- Require-post-before-see.
- Unread/read lifecycle through mark-read request assertions.
- Lazy child reply expansion.
- Discussion list keyboard navigation.
- Moderation hide/restore for teacher, TA, and admin.
- Lock/unlock for teacher.
- Archived/read-only behavior.
- Finalized/module-hidden/group-isolated restrictions through denied student actions and API permission checks.
- Instructor grading.
- Hidden-grade behavior for students.
- Mobile viewport navigation and controls.
- Duplicate reply suppression through stable retry idempotency keys.
- Recovery after failed reply submission with draft preservation and accessible retry alert.
- Payload/status correctness through intercepted API assertions and rendered badge checks.

## Accessibility Scope

Validated:

- Keyboard navigation for discussion cards and skip links.
- Screen reader semantics for status badges, hidden/deleted replies, moderation controls, and reply actions.
- ARIA labels for icon-only controls.
- Menu semantics for reply actions.
- Modal focus behavior via existing `BaseModal` focus trap.
- Nested reply article labeling.
- Status badge live region.
- Mobile controls and touch target visibility.
- Axe checks for discussion desktop and mobile surfaces.

Resolved defects:

- Click-only discussion cards are now buttons with keyboard focus and accessible names.
- Duplicate navigation landmarks now have unique labels.
- Discussion grading heading order no longer jumps from `h1` to `h3`.
- Reply action menus expose `aria-expanded`, `aria-haspopup`, and menu/menuitem semantics.
- Failed reply submission now exposes a `role="alert"` message and preserves draft content.
- Browser retry submits a stable `idempotencyKey` to avoid duplicate replies.

## Known Limitations

- Color contrast is excluded from automated axe assertions in the Playwright audit because the app-wide theme contains legacy non-discussion color combinations. Discussion-specific semantic blockers are enforced.
- Native Safari depends on host availability. On Windows, WebKit is used as the Safari-engine certification target.
- The all-project full Playwright command can produce a Windows worker-teardown error after all tests complete. Use `--workers=1` and project-specific runs for clean CI signals.
- The file UX page-edit E2E is now explicitly opt-in with `E2E_FILE_UI_CERTIFICATION=1` to avoid stale local seed URLs affecting unrelated runs.

## Recommended Commands

Run discussion cross-browser certification:

```powershell
$env:E2E_SKIP_SERVER='1'
$env:E2E_BASE_URL='http://127.0.0.1:5174'
npx playwright test -c e2e/playwright.config.ts e2e/specs/discussion-e2e-accessibility.spec.ts --workers=1
```

Run full Chromium Playwright suite:

```powershell
$env:E2E_SKIP_SERVER='1'
$env:E2E_BASE_URL='http://127.0.0.1:5174'
npx playwright test -c e2e/playwright.config.ts --project=chromium --workers=1
```

Run frontend discussion regression tests:

```powershell
cd frontend
npm run test:run -- tests/unit/components/CourseDiscussions.test.tsx tests/unit/components/ModuleCard.test.tsx tests/unit/components/ThreadView.phaseDE.test.tsx tests/unit/utils/discussionStatus.test.ts tests/unit/utils/discussionWorkflowStatus.test.ts
```
