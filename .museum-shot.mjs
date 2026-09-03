import { chromium } from '@playwright/test';

const browser = await chromium.launch({
	headless: true,
	args: ['--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto('http://localhost:9296/?game=terrain', { waitUntil: 'domcontentloaded', timeout: 150000 });
for (let i = 0; i < 11; i++) {
	await page.waitForTimeout(8000);
	const body = ((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ');
	if (/Skip to entity list/.test(body)) break;
}
await page.waitForTimeout(4000);
await page.screenshot({ path: '/tmp/museum-lighting.png' });
console.log('saved /tmp/museum-lighting.png');
await browser.close();
