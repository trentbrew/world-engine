import { session } from '$lib/engine/net/session.svelte';
import { ui } from '$lib/ui/ui.svelte';
import { botByClientId, resolveActiveBot } from './bots';
import { isBotClientId } from './botPlayer';
import { emitHumanChat, setHumanChatHandler, type HumanChatEvent } from './chatHooks';
import { createFetchAgentBackend, SimpleAgentRuntime } from './simpleAgentRuntime';
import { WorldEnvAdapter } from './worldEnvAdapter';

export { emitHumanChat, setHumanChatHandler };

let runtime: SimpleAgentRuntime | null = null;
let runtimeBotId: string | null = null;

function ensureRuntime(): SimpleAgentRuntime | null {
	const bot = resolveActiveBot();
	if (!bot) {
		runtime = null;
		runtimeBotId = null;
		return null;
	}
	if (runtime && runtimeBotId === bot.id) return runtime;
	const env = new WorldEnvAdapter(bot.clientId);
	runtime = new SimpleAgentRuntime({
		env,
		backend: createFetchAgentBackend(bot.id),
		system: bot.systemPrompt
	});
	runtimeBotId = bot.id;
	return runtime;
}

async function onHumanChat(evt: HumanChatEvent): Promise<void> {
	if (ui.shellMode !== 'play') return;
	if (!session.connected || !session.isHost) return;
	if (isBotClientId(evt.fromClientId)) return;

	const botMember = evt.members.find((id) => isBotClientId(id));
	if (!botMember) return;

	if (!botByClientId(botMember)) return;

	const rt = ensureRuntime();
	if (!rt || rt.busy) return;

	rt.enqueue({
		kind: 'chat',
		at: Date.now(),
		from: evt.fromClientId,
		text: evt.text,
		convoId: evt.convoId,
		members: evt.members
	});
	await rt.tick();
}

export function mountAgentBridge(): () => void {
	setHumanChatHandler((evt) => {
		void onHumanChat(evt);
	});
	return () => {
		setHumanChatHandler(null);
		runtime = null;
		runtimeBotId = null;
	};
}

if (typeof window !== 'undefined') {
	mountAgentBridge();
}
