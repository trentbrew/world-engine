import { expect, test, type Page } from '@playwright/test';
import { primeCollabStorage } from './helpers';

function isBenignConsoleError(text: string): boolean {
	const t = text.toLowerCase();
	return (
		t.includes('webgl') ||
		t.includes('gpu') ||
		t.includes('favicon') ||
		(t.includes('failed to load resource') && t.includes('favicon'))
	);
}

function attachConsoleCollectors(page: Page): string[] {
	const errors: string[] = [];
	page.on('console', (msg) => {
		if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) {
			errors.push(`[console] ${msg.text()}`);
		}
	});
	page.on('pageerror', (err) => {
		if (!isBenignConsoleError(err.message)) errors.push(`[pageerror] ${err.message}`);
	});
	return errors;
}

async function waitForWorldReady(page: Page, mode: 'edit' | 'play' = 'edit') {
	await expect(page.locator('#world-status')).toContainText(/World loaded/i, { timeout: 30_000 });
	await expect(page.locator('.loading-overlay')).toHaveCount(0, { timeout: 90_000 });
	await expect(page.getByRole('region', { name: '3D viewport' })).toBeVisible({ timeout: 30_000 });
	const tab = mode === 'play' ? 'Play' : 'Edit';
	await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true', {
		timeout: 30_000
	});
}

type CanvasSample = {
	error?: string;
	width: number;
	height: number;
	center: { r: number; g: number; b: number; a: number };
	samples: { x: number; y: number; r: number; g: number; b: number; a: number }[];
	nonBlackPixels: number;
	totalSampled: number;
	likelyBlack: boolean;
};

async function sampleViewportCanvas(page: Page): Promise<CanvasSample> {
	return page.evaluate(() => {
		const wrap = document.querySelector('.viewport-canvas');
		const canvas = wrap?.querySelector('canvas') as HTMLCanvasElement | null;
		if (!canvas) {
			return {
				error: 'no canvas in .viewport-canvas',
				width: 0,
				height: 0,
				center: { r: 0, g: 0, b: 0, a: 0 },
				samples: [],
				nonBlackPixels: 0,
				totalSampled: 0,
				likelyBlack: true
			};
		}
		const w = canvas.width;
		const h = canvas.height;
		const gl =
			(canvas.getContext('webgl2', { preserveDrawingBuffer: true }) as WebGLRenderingContext | null) ||
			(canvas.getContext('webgl', { preserveDrawingBuffer: true }) as WebGLRenderingContext | null) ||
			(canvas.getContext('webgl2') as WebGLRenderingContext | null) ||
			(canvas.getContext('webgl') as WebGLRenderingContext | null);

		const points: { x: number; y: number }[] = [
			{ x: Math.floor(w / 2), y: Math.floor(h / 2) },
			{ x: Math.floor(w * 0.25), y: Math.floor(h * 0.25) },
			{ x: Math.floor(w * 0.75), y: Math.floor(h * 0.25) },
			{ x: Math.floor(w * 0.25), y: Math.floor(h * 0.75) },
			{ x: Math.floor(w * 0.75), y: Math.floor(h * 0.75) }
		];

		const readAt = (x: number, y: number) => {
			const px = new Uint8Array(4);
			if (!gl) return { r: -1, g: -1, b: -1, a: -1 };
			gl.readPixels(x, h - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			return { r: px[0], g: px[1], b: px[2], a: px[3] };
		};

		const samples = points.map(({ x, y }) => ({ x, y, ...readAt(x, y) }));
		const center = samples[0] ?? { r: 0, g: 0, b: 0, a: 0, x: 0, y: 0 };
		let nonBlackPixels = 0;
		for (const s of samples) {
			if (s.r > 8 || s.g > 8 || s.b > 8) nonBlackPixels++;
		}
		return {
			width: w,
			height: h,
			center: { r: center.r, g: center.g, b: center.b, a: center.a },
			samples,
			nonBlackPixels,
			totalSampled: samples.length,
			likelyBlack: nonBlackPixels === 0,
			error: gl ? undefined : 'no webgl context'
		};
	});
}

async function ensurePlayMode(page: Page) {
	const playTab = page.getByRole('tab', { name: 'Play' });
	if ((await playTab.getAttribute('aria-selected')) !== 'true') {
		await playTab.click();
	}
	await expect(playTab).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
}

async function exitToEdit(page: Page) {
	const editTab = page.getByRole('tab', { name: 'Edit' });
	if ((await editTab.getAttribute('aria-selected')) !== 'true') {
		await page.keyboard.press('Escape');
	}
	await expect(editTab).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 });
}

async function setPlayCameraOrbit(page: Page) {
	await exitToEdit(page);
	await page.getByRole('tab', { name: 'Room' }).click();
	const playModeTrigger = page.getByRole('button', { name: 'Play mode' });
	await playModeTrigger.click();
	await page.getByRole('radio', { name: 'Orbit' }).click();
}

test.describe.configure({ mode: 'serial' });

test('repro play black — follow (default)', async ({ page }, testInfo) => {
	const errors = attachConsoleCollectors(page);
	await primeCollabStorage(page);
	await page.goto('/?game=physics&room=debug-black&mode=edit');
	await waitForWorldReady(page, 'edit');
	await ensurePlayMode(page);
	await page.waitForTimeout(3000);
	await page.screenshot({ path: 'repro-play-black.png', fullPage: true });
	const sample = await sampleViewportCanvas(page);
	console.log('FOLLOW_CAMERA_SAMPLE', JSON.stringify(sample, null, 2));
	console.log('FOLLOW_CONSOLE_ERRORS', JSON.stringify(errors, null, 2));
	testInfo.annotations.push({ type: 'follow_sample', description: JSON.stringify(sample) });
	testInfo.annotations.push({ type: 'follow_errors', description: JSON.stringify(errors) });
});

test('repro play black — orbit camera before play', async ({ page }, testInfo) => {
	const errors = attachConsoleCollectors(page);
	await primeCollabStorage(page);
	await page.goto('/?game=physics&room=debug-black&mode=edit');
	await waitForWorldReady(page, 'edit');
	await exitToEdit(page);
	await setPlayCameraOrbit(page);
	await ensurePlayMode(page);
	await page.waitForTimeout(3000);
	await page.screenshot({ path: 'repro-play-black-orbit.png', fullPage: true });
	const sample = await sampleViewportCanvas(page);
	console.log('ORBIT_CAMERA_SAMPLE', JSON.stringify(sample, null, 2));
	console.log('ORBIT_CONSOLE_ERRORS', JSON.stringify(errors, null, 2));
	testInfo.annotations.push({ type: 'orbit_sample', description: JSON.stringify(sample) });
	testInfo.annotations.push({ type: 'orbit_errors', description: JSON.stringify(errors) });
});
