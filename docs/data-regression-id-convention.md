# `data-regression-id` convention (UI 100% coverage)

Every user-facing **button, link-as-button, and menu item** should have a stable selector for Playwright:

```tsx
<button
  type="button"
  data-regression-id="discussion-reply-like"
  ...
>
```

## Rules

1. **Kebab-case**, prefixed by area: `discussion-`, `assignment-`, `gradebook-`, etc.
2. Match an entry in `docs/regression-inventory.json` → `ui.regressionId`.
3. Add the id when touching a component; do not batch-refactor the whole app at once.
4. E2E pattern:

```typescript
await page.locator('[data-regression-id="discussion-reply-like"]').click();
await expect(page.locator('[data-regression-id="discussion-reply-like"]')).toHaveAttribute('aria-pressed', 'true');
```

5. **Menus:** put `data-regression-id` on each `menuitem` button, not only the ⋮ trigger.

## Priority order for adding ids

1. Discussions (`ThreadView.tsx`)
2. Assignment submit / quiz (`ViewAssignment.tsx`)
3. Gradebook (`GradebookView.tsx`)
4. Announcement form
5. Inbox compose
6. Account save buttons
7. Admin row actions

## Snapshot pairing

For each `regressionId`, add a Playwright snapshot or interaction test in:

`e2e/specs/regression-interactions/<area>.spec.ts`
