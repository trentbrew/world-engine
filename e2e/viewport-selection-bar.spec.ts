import { expect, test } from '@playwright/test';
import { e2eWorldUrl, primeCollabStorage, selectEntity, waitForWorldReady } from './helpers';

test.describe('viewport selection bar', () => {
	test.beforeEach(async ({ page }) => {
		await primeCollabStorage(page);
	});

	test('transform + entity actions float at viewport top, not in right pane', async ({ page }) => {
		test.setTimeout(90_000);

		await page.goto(e2eWorldUrl('/'));
		await waitForWorldReady(page);

		await selectEntity(page, 'Prop crate-b', 'crate-b');

		const bar = page.getByRole('group', { name: 'Selection tools' });
		await expect(bar).toBeVisible({ timeout: 15_000 });
		await expect(bar).toHaveClass(/chrome-opacity-panel/);
		await expect(bar).toHaveClass(/glass-panel-shell/);
		await expect(bar).toHaveClass(/chrome-float-card/);

		const toolbar = bar.getByRole('toolbar', { name: 'Transform tools' });
		await expect(toolbar).toBeVisible();
		await expect(bar.getByRole('radio', { name: /Move/i })).toBeVisible();
		await expect(toolbar.locator('kbd')).toHaveCount(3);
		await expect(toolbar.locator('kbd')).toContainText(['M', 'R', 'S']);

		const actions = bar.getByRole('group', { name: 'Entity actions' });
		await expect(actions).toBeVisible();
		await expect(bar.getByRole('button', { name: 'Copy' })).toBeVisible();
		await expect(bar.getByRole('button', { name: 'Duplicate' })).toBeVisible();

		const destroy = bar.getByRole('button', { name: 'Destroy' });
		await expect(destroy).toBeEnabled();
		const destroyColor = await destroy.evaluate((el) => getComputedStyle(el).color);
		const destructive = await page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--destructive').trim()
		);
		// Resolve CSS color tokens to rgb for comparison when possible
		const expected = await page.evaluate((token) => {
			const probe = document.createElement('span');
			probe.style.color = token.startsWith('#') || token.startsWith('rgb') ? token : `var(--destructive)`;
			document.body.appendChild(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		}, destructive);
		expect(destroyColor).toBe(expected);

		const inspector = page.getByRole('complementary', { name: 'Inspector' });
		await expect(inspector.getByRole('toolbar', { name: 'Transform tools' })).toHaveCount(0);
		await expect(inspector.getByRole('group', { name: 'Entity actions' })).toHaveCount(0);

		const openType = inspector.getByRole('button', { name: 'Open Prop in Objects' });
		await expect(openType).toBeVisible();
		const orderOk = await inspector.evaluate((root) => {
			const title = root.querySelector('.header-title');
			const open = root.querySelector('.open-objects-btn');
			const badge = root.querySelector('.entity-id-badge');
			if (!title || !open || !badge) return false;
			const pos = title.compareDocumentPosition(open);
			const pos2 = open.compareDocumentPosition(badge);
			return (
				(pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
				(pos2 & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
			);
		});
		expect(orderOk).toBe(true);
	});
});
