/** Local one-shot SFX — client-only, never synced. */

const cache = new Map<string, HTMLAudioElement>();

export function playSfx(url?: string, volume = 1): void {
	const trimmed = url?.trim();
	if (!trimmed || typeof window === 'undefined') return;

	let audio = cache.get(trimmed);
	if (!audio) {
		audio = new Audio(trimmed);
		cache.set(trimmed, audio);
	}

	audio.volume = Math.min(1, Math.max(0, volume));
	audio.currentTime = 0;
	void audio.play().catch(() => {
		// Autoplay policy or missing file — ignore in play mode.
	});
}
