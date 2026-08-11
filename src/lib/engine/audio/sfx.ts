/** Local one-shot SFX — client-only, never synced. */

/** Bundled Switch UI sounds (sandbox defaults). */
export const SFX_SWITCH = {
	jump: '/audio/switch/News.wav',
	collect: '/audio/switch/Bing.wav',
	controllerConnect: '/audio/switch/Controller.wav'
} as const;

const cache = new Map<string, HTMLAudioElement>();

/** Resolve an sfx ref: absolute URL/path, or bare name → `/audio/switch/<name>.wav`. */
export function resolveSfx(ref?: string): string | undefined {
	const trimmed = ref?.trim();
	if (!trimmed) return undefined;
	if (
		trimmed.startsWith('/') ||
		trimmed.startsWith('http://') ||
		trimmed.startsWith('https://')
	) {
		return trimmed;
	}
	const file = trimmed.endsWith('.wav') ? trimmed : `${trimmed}.wav`;
	return `/audio/switch/${file}`;
}

export function playSfx(ref?: string, volume = 1): void {
	const url = resolveSfx(ref);
	if (!url || typeof window === 'undefined') return;

	let audio = cache.get(url);
	if (!audio) {
		audio = new Audio(url);
		cache.set(url, audio);
	}

	audio.volume = Math.min(1, Math.max(0, volume));
	audio.currentTime = 0;
	void audio.play().catch(() => {
		// Autoplay policy or missing file — ignore in play mode.
	});
}
