import type { DurablePatch } from '$lib/engine/ontology/durablePatch';

export type ChatMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string;
};

/** Northbound: observations from any environment. */
export type AgentObservation =
	| { kind: 'chat'; at: number; from: string; text: string; convoId: string; members: string[] }
	| { kind: 'vision'; at: number; jpegBase64: string; caption?: string }
	| { kind: 'event'; at: number; name: string; payload: unknown };

/** Southbound: validated actions back to the environment. */
export type AgentAction =
	| { kind: 'chat'; text: string; convoId: string; members: string[] }
	| { kind: 'move'; target: [number, number, number] }
	| { kind: 'patch'; patches: DurablePatch[] };

export interface AgentEnvAdapter {
	readonly agentId: string;
	observe(): AgentObservation[];
	act(action: AgentAction): Promise<void>;
}

export interface AgentMemory {
	load(sessionKey: string): Promise<ChatMessage[]>;
	save(sessionKey: string, messages: ChatMessage[]): Promise<void>;
}

export interface AgentBackend {
	complete(req: { system: string; messages: ChatMessage[] }): Promise<{ text: string }>;
}

export interface AgentRuntime {
	tick(): Promise<void>;
}
