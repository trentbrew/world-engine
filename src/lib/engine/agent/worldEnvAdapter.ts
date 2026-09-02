import { roomChat } from '$lib/engine/collab/roomChat.svelte';
import { session } from '$lib/engine/net/session.svelte';
import { applyAgentPatches } from './applyAgentPatches';
import { displayNameForBot } from './bots';
import type { AgentAction, AgentEnvAdapter, AgentObservation } from './runtime';

export class WorldEnvAdapter implements AgentEnvAdapter {
	readonly agentId: string;
	#pending: AgentObservation[] = [];

	constructor(agentId: string) {
		this.agentId = agentId;
	}

	pushChat(from: string, text: string, convoId: string, members: string[]): void {
		this.#pending.push({ kind: 'chat', at: Date.now(), from, text, convoId, members });
	}

	observe(): AgentObservation[] {
		const out = this.#pending;
		this.#pending = [];
		return out;
	}

	async act(action: AgentAction): Promise<void> {
		switch (action.kind) {
			case 'chat':
				session.sendChatAs(action.text, {
					fromClientId: this.agentId,
					convoId: action.convoId,
					members: action.members,
					displayName: displayNameForBot(this.agentId) ?? 'Agent'
				});
				break;
			case 'patch': {
				const { applied, errors } = applyAgentPatches(action.patches);
				if (errors.length > 0) {
					console.warn(
						`[agent ${this.agentId}] applied ${applied}/${action.patches.length} patches`
					);
				}
				break;
			}
			case 'move':
				// Locomotion is owned by playerSystem; no agent path yet.
				break;
		}
	}
}

export function roomChatToApiMessages(
	convoId: string,
	agentClientId: string,
	localClientId: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
	return roomChat
		.activeMessages()
		.filter((line) => line.convoId === convoId)
		.map((line) => ({
			role: (line.peerId === agentClientId ? 'assistant' : 'user') as 'user' | 'assistant',
			content:
				line.peerId === localClientId
					? line.text
					: `${line.peerId === agentClientId ? displayNameForBot(line.peerId) ?? 'Agent' : line.peerId}: ${line.text}`
		}));
}
