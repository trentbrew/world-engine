import type { MeshAnchor } from '$lib/engine/render/meshAnchor';
import type { PlacementDraft } from '$lib/scene/placementSession';

export const PLACEMENT_DRAG_MIME = 'application/x-trellis-placement';

export function writePlacementDrag(dataTransfer: DataTransfer, draft: PlacementDraft) {
	dataTransfer.effectAllowed = 'copy';
	dataTransfer.setData(PLACEMENT_DRAG_MIME, JSON.stringify(draft));
}

function asAnchor(value: unknown): MeshAnchor | undefined {
	if (value === 'origin' || value === 'bottom' || value === 'center') return value;
	return undefined;
}

function normalizeDraft(raw: unknown): PlacementDraft | null {
	if (!raw || typeof raw !== 'object') return null;
	const d = raw as Record<string, unknown>;
	if (d.kind === 'type' && typeof d.typeName === 'string') {
		return {
			kind: 'type',
			typeName: d.typeName,
			label: typeof d.label === 'string' ? d.label : d.typeName
		};
	}
	if (d.kind === 'mesh' && typeof d.mesh === 'string') {
		const anchor = asAnchor(d.anchor);
		return {
			kind: 'mesh',
			mesh: d.mesh,
			label: typeof d.label === 'string' ? d.label : d.mesh,
			source: d.source === 'model' ? 'model' : 'shape',
			...(anchor ? { anchor } : {})
		};
	}
	// Legacy mesh drafts (pre kind discriminant)
	if (typeof d.mesh === 'string' && (d.source === 'shape' || d.source === 'model')) {
		const anchor = asAnchor(d.anchor);
		return {
			kind: 'mesh',
			mesh: d.mesh,
			label: typeof d.label === 'string' ? d.label : d.mesh,
			source: d.source,
			...(anchor ? { anchor } : {})
		};
	}
	return null;
}

export function readPlacementDrag(dataTransfer: DataTransfer): PlacementDraft | null {
	const raw = dataTransfer.getData(PLACEMENT_DRAG_MIME);
	if (!raw) return null;
	try {
		return normalizeDraft(JSON.parse(raw));
	} catch {
		return null;
	}
}
