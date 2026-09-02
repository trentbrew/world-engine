/**
 * Verify the WebMCP tool manifest against Chrome's recommended character budgets.
 * See docs/webmcp.md — 30 per name, 500 per description, 150 per parameter description.
 */
import { WEBMCP_TOOLS } from '../src/lib/engine/agent/webmcp/manifest';

const LIMITS = { name: 30, description: 500, paramName: 30, paramDescription: 150 };

let failures = 0;
const rows: string[] = [];

function check(label: string, value: string, limit: number) {
	const n = value.length;
	const ok = n <= limit;
	if (!ok) failures++;
	rows.push(`${ok ? 'ok  ' : 'FAIL'}  ${String(n).padStart(4)}/${limit}  ${label}`);
}

for (const tool of WEBMCP_TOOLS) {
	check(tool.name, tool.name, LIMITS.name);
	check(`${tool.name}.description`, tool.description, LIMITS.description);
	const props = (tool.inputSchema.properties ?? {}) as Record<string, { description?: string }>;
	for (const [param, schema] of Object.entries(props)) {
		check(`${tool.name}.${param}`, param, LIMITS.paramName);
		if (schema.description) {
			check(`${tool.name}.${param}.description`, schema.description, LIMITS.paramDescription);
		}
	}
}

console.log(rows.join('\n'));
console.log(
	`\n${WEBMCP_TOOLS.length} tools, ${rows.length} checks, ${failures} over budget.`
);
process.exit(failures > 0 ? 1 : 0);
