import { expect, type Page } from '@playwright/test';

/** World URL with inspector tabs enabled (Props / Ops / JSON). Default UI hides them. */
export function e2eWorldUrl(path = '/'): string {
	const url = new URL(path, 'http://e2e.local');
	url.searchParams.set('inspectorTabs', '1');
	return `${url.pathname}${url.search}`;
}

export async function primeCollabStorage(page: Page) {
	await page.addInitScript(() => {
		localStorage.setItem('collab:username-prompted', '1');
	});
}

export async function waitForWorldReady(page: Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
	await expect(page.getByRole('tree', { name: 'World entities' })).toBeVisible({ timeout: 30_000 });
}

/** Wait for tree selection to propagate to the inspector (avoids GroundPlane race). */
export async function selectEntity(page: Page, treeItemName: string, shortId: string) {
	const item = page.getByRole('treeitem', { name: treeItemName, exact: true });
	await expect(item).toBeVisible({ timeout: 30_000 });
	await item.click();
	await expect(item).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
	const header = page.locator('.inspector-header');
	await expect(header.getByText(shortId, { exact: true })).toBeVisible({ timeout: 15_000 });
}

/** Read the selected entity's JSON from the inspector JSON tab. */
export async function readEntityJson(page: Page) {
	await page.getByRole('tab', { name: 'JSON' }).click();
	const editor = page.getByRole('textbox', { name: 'Entity JSON editor' });
	await expect(editor).toBeVisible();
	return JSON.parse(await editor.inputValue()) as {
		'@id'?: string;
		components: Record<string, Record<string, unknown>>;
	};
}

export async function dismissAllToasts(page: Page) {
	for (let i = 0; i < 12; i++) {
		const close = page.getByRole('button', { name: 'Close toast' });
		if ((await close.count()) === 0) break;
		await close.first().click({ force: true });
		await page.waitForTimeout(250);
	}
}

export async function waitForToastsToClear(page: Page) {
	await dismissAllToasts(page);
	const toast = page.locator('[data-sonner-toast]');
	if ((await toast.count()) > 0) {
		await toast
			.first()
			.waitFor({ state: 'hidden', timeout: 15_000 })
			.catch(() => {});
	}
}

export async function enterEditMode(page: Page) {
	await page.keyboard.press('Escape');
	await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
}

export async function enterPlayMode(page: Page) {
	await page.getByRole('tab', { name: 'Play' }).click();
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
}

/** Objects route — right inspector (Properties / Events / Schedule / Clip). */
export async function objectTypeBehaviorPane(page: Page) {
	const inspector = page.getByRole('complementary', { name: 'Object type inspector' });
	await expect(inspector.getByRole('tab', { name: 'Events' })).toBeVisible({
		timeout: 10_000
	});
	return inspector;
}

/** Open the Objects Events inspector tab. */
export async function openObjectTypeBehaviorPane(page: Page) {
	const inspector = page.getByRole('complementary', { name: 'Object type inspector' });
	const eventsTab = inspector.getByRole('tab', { name: 'Events' });
	await expect(eventsTab).toBeVisible({ timeout: 10_000 });
	if ((await eventsTab.getAttribute('aria-selected')) !== 'true') {
		await eventsTab.click();
	}
	await expect(inspector.getByLabel('Type events')).toBeVisible({ timeout: 10_000 });
	return objectTypeBehaviorPane(page);
}

/** Submit the type behavior form without pointer-click (avoids pane overlap). */
export async function submitTypeBehaviorForm(
	page: Page,
	behavior = page.getByRole('complementary', { name: 'Object type inspector' })
) {
	const form = behavior.locator('form[aria-label="Add type event action"]');
	await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());
}
