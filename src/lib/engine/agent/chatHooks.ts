export type HumanChatEvent = {
	fromClientId: string;
	text: string;
	convoId: string;
	members: string[];
};

let onHumanChat: ((evt: HumanChatEvent) => void) | null = null;

export function setHumanChatHandler(fn: ((evt: HumanChatEvent) => void) | null): void {
	onHumanChat = fn;
}

export function emitHumanChat(evt: HumanChatEvent): void {
	onHumanChat?.(evt);
}
