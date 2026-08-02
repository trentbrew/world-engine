import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

async function waitForEditWorld(page: Page) {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
	await expect(page.getByRole('tab', { name: 'Edit' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 30_000
	});
}

// Sample from a composited element screenshot — drawImage() on the WebGL canvas
// reads a cleared drawing buffer (preserveDrawingBuffer: false) and lies black.
async function viewportCenterRgb(page: Page): Promise<[number, number, number]> {
	const shot = await page.locator('.viewport-canvas canvas').first().screenshot();
	return page.evaluate(async (b64) => {
		const img = new Image();
		img.src = `data:image/png;base64,${b64}`;
		await img.decode();
		const tmp = document.createElement('canvas');
		tmp.width = img.width;
		tmp.height = img.height;
		const tctx = tmp.getContext('2d');
		if (!tctx) return [0, 0, 0] as [number, number, number];
		tctx.drawImage(img, 0, 0);
		const px = tctx.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
		return [px[0], px[1], px[2]] as [number, number, number];
	}, shot.toString('base64'));
}

function expectSceneVisible([r, g, b]: [number, number, number]) {
	expect(r + g + b, 'viewport should not be flat black').toBeGreaterThan(30);
}

test.describe.configure({ mode: 'serial' });

test('edit mode renders orbit game', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto('/?game=orbit');
	await waitForEditWorld(page);
	const rgb = await viewportCenterRgb(page);
	expectSceneVisible(rgb);
});

test('play then edit restores orbit viewport', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto('/?game=physics&room=play-edit-test&mode=play');
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 30_000
	});

	const playRgb = await viewportCenterRgb(page);
	expectSceneVisible(playRgb);

	await page.keyboard.press('Escape');
	await waitForEditWorld(page);

	const editRgb = await viewportCenterRgb(page);
	expectSceneVisible(editRgb);
});

test('2d platformer survives edit play edit cycles', async ({ page }) => {
	await primeCollabStorage(page);
	await page.goto('/?game=platformer2d&room=play-edit-2d');
	await waitForEditWorld(page);

	const editRgb = await viewportCenterRgb(page);
	expectSceneVisible(editRgb);

	await page.getByRole('tab', { name: 'Play' }).click();
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
	const playRgb = await viewportCenterRgb(page);
	expectSceneVisible(playRgb);

	await page.keyboard.press('Escape');
	await waitForEditWorld(page);
	const editAgainRgb = await viewportCenterRgb(page);
	expectSceneVisible(editAgainRgb);

	await page.getByRole('tab', { name: 'Play' }).click();
	await expect(page.getByRole('tab', { name: 'Play' })).toHaveAttribute('aria-selected', 'true', {
		timeout: 15_000
	});
	const playAgainRgb = await viewportCenterRgb(page);
	expectSceneVisible(playAgainRgb);
});
