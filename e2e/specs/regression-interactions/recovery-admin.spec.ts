import { test, expect, APIRequestContext } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as path from 'path';
import { apiURL, getAuthToken, admin, loginViaForm } from '../../helpers/live-auth';

/**
 * §21 deferral close — Admin File Recovery Center (was: "not linked this pass").
 *
 * The center lives inside /admin/settings → Operations tab. We seed one ephemeral
 * soft-deleted FileAsset via a throwaway script, then through the real UI:
 *   - open the center, search for it, select it,
 *   - run a non-destructive "Preview restore" (dry run),
 *   - "Restore file" (the headline recovery action),
 * and verify via the recovery API that it left the deleted list. The seeded
 * asset is hard-deleted in afterAll.
 */

const repoRoot = path.resolve(__dirname, '../../../');
const seedScript = path.join(repoRoot, 'scripts', 'e2eSeedRecoveryFile.js');

let adminToken: string;
let deletedFileId: string;
let deletedFileName: string;

function runSeed(args: string[] = []): string {
  return execFileSync('node', [seedScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

async function deletedListIds(request: APIRequestContext, search: string): Promise<string[]> {
  const res = await request.get(
    `${apiURL}/api/ops/recovery/files?filter=deleted&search=${encodeURIComponent(search)}`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  if (!res.ok()) return [];
  const body = await res.json();
  return ((body.data?.items || []) as { _id: string }[]).map((i) => String(i._id));
}

test.beforeAll(async ({ request }) => {
  adminToken = await getAuthToken(request, admin);
  const out = runSeed();
  const parsed = JSON.parse(out.split('\n').pop() as string);
  deletedFileId = parsed.id;
  deletedFileName = parsed.originalName;
  expect(deletedFileId).toBeTruthy();
});

test.afterAll(async () => {
  if (deletedFileId) {
    try {
      runSeed(['--cleanup', deletedFileId]);
    } catch {
      /* best effort */
    }
  }
});

test.describe('§21 Admin — file recovery center', () => {
  test.use({ viewport: { width: 1280, height: 950 } });

  test('open recovery center → preview + restore a deleted file', async ({ page, request }) => {
    // Sanity: the seeded file is in the deleted list before we restore it.
    expect(await deletedListIds(request, deletedFileName)).toContain(deletedFileId);

    await loginViaForm(page, admin.email, admin.password);
    await page.goto('/admin/settings');

    await page.getByRole('button', { name: /^operations$/i }).click();
    await expect(page.getByRole('heading', { name: /file recovery center/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByLabel('Search recoverable files').fill(deletedFileName);

    const fileOption = page.getByRole('option', { name: new RegExp(deletedFileName, 'i') });
    await expect(fileOption).toBeVisible({ timeout: 20_000 });
    await fileOption.click();

    // Non-destructive dry run first.
    await page.getByRole('button', { name: /preview restore/i }).click();
    await expect(page.locator('pre').first()).toBeVisible({ timeout: 15_000 });

    // Headline recovery action.
    const [restoreRes] = await Promise.all([
      page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/ops/recovery/files/${deletedFileId}/restore` &&
          r.request().method() === 'POST',
        { timeout: 20_000 }
      ),
      page.getByRole('button', { name: /^restore file$/i }).click(),
    ]);
    expect(restoreRes.ok(), await restoreRes.text()).toBeTruthy();
    await expect(page.getByText('Action completed.')).toBeVisible({ timeout: 15_000 });

    // Verify via API that it's no longer soft-deleted.
    await expect
      .poll(() => deletedListIds(request, deletedFileName), { timeout: 15_000 })
      .not.toContain(deletedFileId);
  });
});
