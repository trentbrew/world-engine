import type { EventAction } from '$lib/engine/ontology/schema';

export function actionSummary(action: EventAction): string {
	if ('set' in action) return `set ${action.set} = ${String(action.to)}`;
	if ('spawn' in action) return `spawn ${action.spawn}${action.at ? ` at ${String(action.at)}` : ''}`;
	if ('destroy' in action) return `destroy ${action.destroy}`;
	if ('if' in action) {
		const thenPart = action.then.map((nested) => actionSummary(nested)).join('; ');
		const elsePart = action.else?.map((nested) => actionSummary(nested)).join('; ');
		return elsePart
			? `if ${String(action.if)} then ${thenPart} else ${elsePart}`
			: `if ${String(action.if)} then ${thenPart}`;
	}
	if ('alarm' in action) return `alarm ${action.alarm} in ${String(action.in)}`;
	if ('score' in action) return `score += ${String(action.score)}`;
	if ('sfx' in action) return `sfx ${String(action.sfx)}`;
	return JSON.stringify(action);
}
