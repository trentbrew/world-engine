/** Pick a paste/spawn id that does not collide with existing entities. */
export function nextPasteId(baseId: string, existingIds: ReadonlySet<string>): string {
	const match = baseId.match(/^(entity:[^/]+\/)(.+)$/);
	if (!match) {
		let n = 2;
		while (existingIds.has(`${baseId}-${n}`)) n++;
		return `${baseId}-${n}`;
	}

	const [, prefix, slug] = match;
	const copyId = `${prefix}${slug}-copy`;
	if (!existingIds.has(copyId)) return copyId;

	let n = 2;
	while (existingIds.has(`${prefix}${slug}-copy-${n}`)) n++;
	return `${prefix}${slug}-copy-${n}`;
}
