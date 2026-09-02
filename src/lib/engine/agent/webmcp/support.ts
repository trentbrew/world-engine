/** True when the browser exposes `document.modelContext` (origin trial or testing flag). */
export function probeWebMcpSupport(): boolean {
	if (typeof document === 'undefined') return false;
	const ctx = (document as unknown as { modelContext?: { registerTool?: unknown } }).modelContext;
	return !!ctx && typeof ctx.registerTool === 'function';
}
