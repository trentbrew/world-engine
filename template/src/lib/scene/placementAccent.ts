/** Read theme token for placement ghost / grid highlight (computed color from CSS). */
export function readAccentEntityColor(): string {
	if (typeof document === 'undefined') return 'rgb(166, 166, 166)';
	const value = getComputedStyle(document.documentElement).getPropertyValue('--accent-entity').trim();
	return value || 'rgb(166, 166, 166)';
}
