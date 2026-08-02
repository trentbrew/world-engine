/** Frontend-only collaboration identity + room alias (localStorage). */

import { peerColor, peerDisplayName, PEER_COLORS } from '$lib/engine/collab/peerColor';

const USERNAME_KEY = 'collab:username';
const PROMPTED_KEY = 'collab:username-prompted';
const AVATAR_COLOR_KEY = 'collab:avatar-color';

function roomAliasKey(roomId: string): string {
	return `collab:room-alias:${roomId}`;
}

class CollabState {
	username = $state('');
	roomId = $state('');
	roomAlias = $state('');
	usernamePromptOpen = $state(false);
	identityDialogOpen = $state(false);
	avatarColor = $state<string | null>(null);
	#clientId = '';

	constructor() {
		if (typeof window !== 'undefined') {
			this.username = localStorage.getItem(USERNAME_KEY) ?? '';
			const storedColor = localStorage.getItem(AVATAR_COLOR_KEY);
			if (storedColor && (PEER_COLORS as readonly string[]).includes(storedColor)) {
				this.avatarColor = storedColor;
			}
		}
	}

	setClientId(clientId: string) {
		this.#clientId = clientId;
	}

	localDisplayName(): string {
		return peerDisplayName(this.#clientId, this.username);
	}

	localAvatarColor(): string {
		return this.avatarColor ?? peerColor(this.#clientId);
	}

	displayNameFor(clientId: string, wireName = ''): string {
		if (wireName.trim()) return wireName.trim();
		return peerDisplayName(clientId, clientId === this.#clientId ? this.username : '');
	}

	initRoom(roomId: string, defaultAlias: string) {
		this.roomId = roomId;
		if (typeof window === 'undefined') {
			this.roomAlias = defaultAlias;
			return;
		}
		const stored = localStorage.getItem(roomAliasKey(roomId));
		this.roomAlias = stored ?? defaultAlias;
	}

	setUsername(value: string) {
		const trimmed = value.trim().slice(0, 32);
		this.username = trimmed;
		if (typeof window === 'undefined') return;
		if (trimmed) localStorage.setItem(USERNAME_KEY, trimmed);
		else localStorage.removeItem(USERNAME_KEY);
	}

	setAvatarColor(value: string | null) {
		if (value !== null && !(PEER_COLORS as readonly string[]).includes(value)) return;
		this.avatarColor = value;
		if (typeof window === 'undefined') return;
		if (value) localStorage.setItem(AVATAR_COLOR_KEY, value);
		else localStorage.removeItem(AVATAR_COLOR_KEY);
	}

	openIdentityDialog() {
		this.identityDialogOpen = true;
	}

	closeIdentityDialog() {
		this.identityDialogOpen = false;
	}

	setRoomAlias(value: string) {
		const trimmed = value.trim().slice(0, 64);
		this.roomAlias = trimmed || this.roomId;
		if (typeof window === 'undefined' || !this.roomId) return;
		localStorage.setItem(roomAliasKey(this.roomId), this.roomAlias);
	}

	maybeOpenUsernamePrompt() {
		if (typeof window === 'undefined') return;
		if (localStorage.getItem(PROMPTED_KEY)) return;
		this.usernamePromptOpen = true;
	}

	dismissUsernamePrompt(skipped: boolean, username?: string) {
		if (!skipped && username !== undefined) this.setUsername(username);
		if (typeof window !== 'undefined') localStorage.setItem(PROMPTED_KEY, '1');
		this.usernamePromptOpen = false;
	}
}

export const collab = new CollabState();
export { PEER_COLORS };
