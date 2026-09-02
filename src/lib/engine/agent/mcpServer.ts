/**
 * MCP stdio server — exposes the WebMCP tool manifest against a headless relay room.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { openHeadlessRoom, type HeadlessRoomOptions } from '$lib/engine/agent/headlessRoom';
import { executeWebMcpTool } from '$lib/engine/agent/webmcp/execute';
import { WEBMCP_TOOLS } from '$lib/engine/agent/webmcp/manifest';

export type AgentRoomMcpOptions = HeadlessRoomOptions;

/** Start stdio MCP after joining a relay room. Blocks until the process exits. */
export async function runAgentRoomMcp(opts: AgentRoomMcpOptions = {}): Promise<void> {
	const room = await openHeadlessRoom(opts);

	const server = new Server(
		{
			name: 'museum-agent-room',
			version: '0.1.0'
		},
		{
			capabilities: {
				tools: {}
			}
		}
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: WEBMCP_TOOLS.map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema
		}))
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const name = request.params.name;
		const args = (request.params.arguments ?? {}) as Record<string, unknown>;
		const text = await executeWebMcpTool(name, args);
		const isError = text.startsWith('Error:');
		return {
			content: [{ type: 'text', text }],
			isError
		};
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);

	const shutdown = () => {
		room.close();
		void server.close();
	};
	process.once('SIGINT', shutdown);
	process.once('SIGTERM', shutdown);

	// Log join metadata on stderr so stdio stays clean for MCP.
	console.error(
		`[agent-room] joined room=${room.room} game=${room.game} clientId=${room.clientId} relay=${room.relayUrl}`
	);
}
