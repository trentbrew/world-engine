export type HumanChatEvent = {
	fromClientId: string;
	text: string;
	convoId: string;
	members: string[];
};

let onHumanChat: ((evt: HumanChatEvent) => void) | null = null;
const listeners = new Set<(evt: HumanChatEvent) => void>();

export function addHumanChatListener(fn: (evt: HumanChatEvent) => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function setHumanChatHandler(fn: ((evt: HumanChatEvent) => void) | null): void {
	onHumanChat = fn;
}

export function emitHumanChat(evt: HumanChatEvent): void {
	onHumanChat?.(evt);
	for (const fn of listeners) {
		try {
			fn(evt);
		} catch (e) {
			console.error('Human chat listener error:', e);
		}
	}
}
