import { error, json } from '@sveltejs/kit';
import { botById } from '$lib/engine/agent/bots';
import type { ChatMessage } from '$lib/engine/agent/runtime';
import type { RequestHandler } from './$types';

const OLLAMA_URL = process.env.AGENT_OLLAMA_URL ?? 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.AGENT_OLLAMA_MODEL ?? 'muse-glimmer';
const MOCK_REPLY =
	"Hello! I'm Brave. (mock — start Ollama with muse-glimmer for real replies)";

type ChatBody = {
	botId?: string;
	convoId?: string;
	messages?: ChatMessage[];
};

const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function rateLimitKey(request: Request): string {
	return (
		request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		request.headers.get('x-real-ip') ||
		'local'
	);
}

function checkRateLimit(key: string): boolean {
	const now = Date.now();
	const bucket = rateBuckets.get(key);
	if (!bucket || now >= bucket.resetAt) {
		rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return true;
	}
	if (bucket.count >= RATE_LIMIT) return false;
	bucket.count += 1;
	return true;
}

async function completeViaOllama(system: string, messages: ChatMessage[]): Promise<string> {
	const res = await fetch(`${OLLAMA_URL}/api/chat`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			model: OLLAMA_MODEL,
			stream: false,
			messages: [{ role: 'system', content: system }, ...messages]
		})
	});
	if (!res.ok) {
		const detail = await res.text().catch(() => res.statusText);
		throw new Error(detail || `Ollama ${res.status}`);
	}
	const data = (await res.json()) as { message?: { content?: string } };
	return (data.message?.content ?? '').trim();
}

export const POST: RequestHandler = async ({ request }) => {
	const key = rateLimitKey(request);
	if (!checkRateLimit(key)) throw error(429, 'Rate limit exceeded');

	let body: ChatBody;
	try {
		body = (await request.json()) as ChatBody;
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	const bot = body.botId ? botById(body.botId) : null;
	if (!bot) throw error(400, 'Unknown botId');

	const messages = (body.messages ?? []).filter(
		(m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
	);
	if (messages.length === 0) throw error(400, 'Missing messages');

	try {
		const text = (await completeViaOllama(bot.systemPrompt, messages)).slice(0, 280);
		if (text) return json({ text, source: 'ollama' });
	} catch (err) {
		console.warn('[agent/chat] Ollama unavailable — mock fallback', err);
	}

	return json({ text: MOCK_REPLY, source: 'mock' });
};
