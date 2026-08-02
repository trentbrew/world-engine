import { expect, test, type Page } from '@playwright/test';

async function waitForWorldReady(page: Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
}

function railNav(page: Page) {
	return page.getByRole('navigation', { name: 'World navigation' });
}

/** Clear rail order once per test tab; keep it across reloads. */
async function primeStorage(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
		if (!sessionStorage.getItem('e2e:rail-order-primed')) {
			localStorage.removeItem('playlab:rail-order');
			sessionStorage.setItem('e2e:rail-order-primed', '1');
		}
	});
}

test.describe('rail reorder', () => {
	test('drag reorders items and persists across reload', async ({ page }) => {
		await primeStorage(page);
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		const nav = railNav(page);
		await expect(nav.getByRole('button', { name: 'Graph' })).toBeVisible();

		const before = await nav.locator('button[aria-label]').evaluateAll((buttons) =>
			buttons.map((button) => button.getAttribute('aria-label'))
		);
		expect(before[0]).toBe('Graph');
		expect(before.at(-1)).toBe('Config');

		await nav.getByRole('button', { name: 'Graph' }).dragTo(nav.getByRole('button', { name: 'Rooms' }));

		const after = await nav.locator('button[aria-label]').evaluateAll((buttons) =>
			buttons.map((button) => button.getAttribute('aria-label'))
		);
		expect(after.at(-1)).toBe('Config');
		expect(after.indexOf('Graph')).toBe(after.indexOf('Rooms') - 1);
		expect(after).not.toEqual(before);

		await page.reload();
		await waitForWorldReady(page);

		const persisted = await railNav(page)
			.locator('button[aria-label]')
			.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')));
		expect(persisted).toEqual(after);
	});

	test('click still navigates when not dragging', async ({ page }) => {
		await primeStorage(page);
		await page.goto('/?game=orbit');
		await waitForWorldReady(page);

		await railNav(page).getByRole('button', { name: 'Controls' }).click();
		await expect(page.getByRole('button', { name: 'Controls' })).toHaveAttribute(
			'aria-current',
			'true'
		);
	});
});
