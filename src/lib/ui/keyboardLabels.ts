/** Platform-aware modifier label for shortcut hints. */
export function modShortcut(key: string): string {
	if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)) {
		return `⌘${key}`;
	}
	return `Ctrl+${key}`;
}

export function shortEntityId(id: string): string {
	const parts = id.split('/');
	return parts[parts.length - 1] ?? id;
}
