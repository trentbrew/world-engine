import type {
	AgentBackend,
	AgentEnvAdapter,
	AgentMemory,
	AgentObservation,
	AgentRuntime,
	ChatMessage
} from './runtime';
import type { WorldEnvAdapter } from './worldEnvAdapter';

class InMemoryAgentMemory implements AgentMemory {
	#store = new Map<string, ChatMessage[]>();

	async load(sessionKey: string): Promise<ChatMessage[]> {
		return this.#store.get(sessionKey) ?? [];
	}

	async save(sessionKey: string, messages: ChatMessage[]): Promise<void> {
		this.#store.set(sessionKey, messages.slice(-40));
	}
}

export class SimpleAgentRuntime implements AgentRuntime {
	#env: AgentEnvAdapter;
	#memory: AgentMemory;
	#backend: AgentBackend;
	#system: string;
	#busy = false;

	constructor(opts: {
		env: AgentEnvAdapter;
		memory?: AgentMemory;
		backend: AgentBackend;
		system: string;
	}) {
		this.#env = opts.env;
		this.#memory = opts.memory ?? new InMemoryAgentMemory();
		this.#backend = opts.backend;
		this.#system = opts.system;
	}

	get busy(): boolean {
		return this.#busy;
	}

	enqueue(observation: AgentObservation): void {
		if (observation.kind === 'chat') {
			const env = this.#env as WorldEnvAdapter;
			env.pushChat(observation.from, observation.text, observation.convoId, observation.members);
		}
	}

	async tick(): Promise<void> {
		if (this.#busy) return;
		const observations = this.#env.observe();
		const chats = observations.filter((o): o is Extract<AgentObservation, { kind: 'chat' }> => o.kind === 'chat');
		if (chats.length === 0) return;

		const latest = chats[chats.length - 1]!;
		if (latest.from === this.#env.agentId) return;

		this.#busy = true;
		try {
			const sessionKey = `${this.#env.agentId}:${latest.convoId}`;
			const history = await this.#memory.load(sessionKey);
			const userMsg: ChatMessage = { role: 'user', content: latest.text };
			const messages = [...history, userMsg];
			const { text } = await this.#backend.complete({ system: this.#system, messages });
			const reply = text.trim().slice(0, 280);
			if (!reply) return;

			const members =
				latest.members.length > 0
					? latest.members
					: [...new Set([latest.from, this.#env.agentId])].sort((a, b) => a.localeCompare(b));
			await this.#env.act({ kind: 'chat', text: reply, convoId: latest.convoId, members });
			await this.#memory.save(sessionKey, [
				...messages,
				{ role: 'assistant', content: reply }
			]);
		} finally {
			this.#busy = false;
		}
	}
}

export function createFetchAgentBackend(botId: string): AgentBackend {
	return {
		async complete(req) {
			const res = await fetch('/api/agent/chat', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ botId, messages: req.messages })
			});
			if (!res.ok) {
				const err = await res.text().catch(() => res.statusText);
				throw new Error(err || `Agent API ${res.status}`);
			}
			const data = (await res.json()) as { text?: string };
			return { text: data.text ?? '' };
		}
	};
}
