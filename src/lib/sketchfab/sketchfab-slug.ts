/** Pure filename slug for Sketchfab imports (no I/O, no secrets). */
export function slugifySketchfabName(s: string): string {
	return (
		(s || '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 48) || 'model'
	);
}
