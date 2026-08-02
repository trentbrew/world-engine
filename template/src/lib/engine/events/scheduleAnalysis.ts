import type { EntityEvents, EventAction } from '$lib/engine/ontology/schema';

export type ScheduleChip = {
	atSec: number;
	clip: string;
	partial?: boolean;
};

const CLIP_SET = 'Mesh3DAnimator.clip';

function clipFromAction(action: EventAction): string | null {
	if ('set' in action && action.set === CLIP_SET) return String(action.to);
	return null;
}

/** Walk alarm chains from create + alarm handlers; static only (no simulation). */
export function analyzeClipSchedule(events: EntityEvents | undefined): {
	chips: ScheduleChip[];
	partial: boolean;
} {
	if (!events) return { chips: [], partial: false };

	const chips: ScheduleChip[] = [];
	let partial = false;
	const visited = new Set<string>();

	function walk(handlerKey: string, offsetSec: number, depth: number) {
		if (depth > 24 || visited.has(`${handlerKey}@${offsetSec}`) || !events) return;
		visited.add(`${handlerKey}@${offsetSec}`);

		const actions = events[handlerKey as keyof EntityEvents];
		if (!Array.isArray(actions)) return;

		for (const action of actions as EventAction[]) {
			if ('if' in action) {
				partial = true;
				continue;
			}
			const clip = clipFromAction(action);
			if (clip) chips.push({ atSec: offsetSec, clip, partial: partial || undefined });

			if ('alarm' in action && typeof action.in === 'number') {
				const nextKey = `alarm${action.alarm}`;
				walk(nextKey, offsetSec + action.in, depth + 1);
			}
		}
	}

	walk('create', 0, 0);

	// Initial clip from create if set directly (no alarm offset)
	const create = events.create ?? [];
	for (const action of create) {
		const clip = clipFromAction(action);
		if (clip) chips.unshift({ atSec: 0, clip });
	}

	chips.sort((a, b) => a.atSec - b.atSec);
	return { chips, partial };
}
