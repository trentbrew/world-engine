import { defineConfig, devices } from '@playwright/test';

const port = process.env.VITE_PORT ?? '9292';
const baseURL = process.env.PW_BASE_URL ?? `http://localhost:${port}`;
const isCI = !!process.env.CI;
const coldStart = process.env.PW_COLD === '1';
// Local default: dev stack must be up (`just run`). CI and PW_COLD=1 boot Vite here.
const useWebServer = isCI || coldStart;

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// WebGL/Three.js tests contend on GPU; cap parallelism to reduce flaky hangs locally.
	workers: process.env.CI ? 1 : 2,
	reporter: process.env.CI ? 'github' : 'line',
	timeout: 60_000,
	globalTimeout: process.env.CI ? 600_000 : 300_000,
	maxFailures: process.env.CI ? undefined : 5,
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		launchOptions: {
			// Forcing SwiftShader breaks WebGL context creation on local macOS headless
			// Chromium; only CI (linux, no GPU) needs the software-GL path.
			args: process.env.CI
				? [
						'--use-gl=angle',
						'--use-angle=swiftshader-webgl',
						'--enable-webgl',
						'--ignore-gpu-blocklist'
					]
				: ['--enable-webgl', '--ignore-gpu-blocklist']
		}
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: useWebServer
		? {
				command: `pnpm exec vite dev --port ${port}`,
				url: baseURL,
				reuseExistingServer: !isCI,
				timeout: 120_000
			}
		: undefined
});
