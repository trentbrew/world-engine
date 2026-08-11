/** Play-mode viewport HUD accordion — only one pill panel open at a time. */

export type PlayHudMenuId = 'camera' | 'stats' | 'jank';

class PlayHudMenuState {
	openId = $state<PlayHudMenuId | null>(null);

	isOpen(id: PlayHudMenuId): boolean {
		return this.openId === id;
	}

	toggle(id: PlayHudMenuId): void {
		this.openId = this.openId === id ? null : id;
	}

	close(): void {
		this.openId = null;
	}
}

export const playHudMenu = new PlayHudMenuState();
