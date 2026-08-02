/**
 * Lightweight toasts when remote peers author the scene in edit mode.
 * Durable / structural edits notify immediately (deduped). Transform drags
 * debounce so gizmo drags collapse to one toast per peer + entity.
 *
 * Intentionally skips play-mode state replication (~20 Hz) — that would be noise.
 */
import MoveIcon from '@lucide/svelte/icons/move';
import PencilIcon from '@lucide/svelte/icons/pencil';
import PlusIcon from '@lucide/svelte/icons/plus';
import MinusIcon from '@lucide/svelte/icons/minus';
import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
import SettingsIcon from '@lucide/svelte/icons/settings';
import ShapesIcon from '@lucide/svelte/icons/shapes';
import Trash2Icon from '@lucide/svelte/icons/trash-2';
import { collab } from '$lib/engine/collab/collab.svelte';
import type { DurablePatch, DurablePatchKind } from '$lib/engine/ontology/durableStore';
import { isFieldPatch, patchKind } from '$lib/engine/ontology/durablePatch';
import type { Entity } from '$lib/engine/ontology/schema';
import { isPlayerEntity } from '$lib/engine/player/access';
import { SCENE_SETTINGS_ENTITY_ID } from '$lib/engine/scene/sceneDocument';
import { peerToast } from '$lib/ui/toastPeer';

const TRANSFORM_QUIET_MS = 1200;
const FIELD_QUIET_MS = 500;

const transformTimers = new Map<string, ReturnType<typeof setTimeout>>();
const fieldTimers = new Map<string, ReturnType<typeof setTimeout>>();

function shortEntityId(id: string): string {
	const parts = id.split('/');
	return parts[parts.length - 1] ?? id;
}

function peerLabel(peerId: string, wireName = ''): string {
	return collab.displayNameFor(peerId, wireName);
}

function transformVerb(field: string): string {
	switch (field) {
		case 'position':
			return 'moved';
		case 'rotation':
			return 'rotated';
		case 'scale':
			return 'resized';
		default:
			return 'transformed';
	}
}

function transformIcon(field: string) {
	switch (field) {
		case 'position':
			return MoveIcon;
		case 'rotation':
			return RotateCwIcon;
		case 'scale':
			return Maximize2Icon;
		default:
			return PencilIcon;
	}
}

function showToast(peerId: string, id: string, message: string, icon = PencilIcon) {
	peerToast(peerId, message, { id, duration: 3500, icon });
}

function scheduleToast(
	store: Map<string, ReturnType<typeof setTimeout>>,
	key: string,
	delayMs: number,
	peerId: string,
	message: string,
	toastId: string,
	icon = PencilIcon
) {
	const prior = store.get(key);
	if (prior) clearTimeout(prior);
	store.set(
		key,
		setTimeout(() => {
			store.delete(key);
			showToast(peerId, toastId, message, icon);
		}, delayMs)
	);
}

type DurableKindPatch<K extends Exclude<DurablePatchKind, 'setField'>> = Extract<
	DurablePatch,
	{ kind: K }
>;

function isKindPatch<K extends Exclude<DurablePatchKind, 'setField'>>(
	patch: DurablePatch,
	kind: K
): patch is DurableKindPatch<K> {
	return 'kind' in patch && patch.kind === kind;
}

/** Remote durable graph edit (inspector fields, components, types, …). */
export function notifyPeerDurableEdit(
	peerId: string,
	patch: DurablePatch,
	wireName = ''
) {
	const formatted = formatDurableMessage(peerId, patch, wireName);
	if (!formatted) return;

	const { message, icon } = formatted;
	const kind = patchKind(patch);
	if (kind === 'setField' && isFieldPatch(patch) && patch.component === 'Transform') {
		const key = `${peerId}:${patch.entityId}:transform`;
		scheduleToast(
			transformTimers,
			key,
			TRANSFORM_QUIET_MS,
			peerId,
			message,
			`peer-edit:${key}`,
			icon
		);
		return;
	}

	if (kind === 'setField' && isFieldPatch(patch)) {
		const key = `${peerId}:${patch.entityId}:${patch.component}.${patch.field}`;
		scheduleToast(
			fieldTimers,
			key,
			FIELD_QUIET_MS,
			peerId,
			message,
			`peer-edit:${key}`,
			icon
		);
		return;
	}

	const toastId = `peer-edit:${peerId}:${kind}:${'entityId' in patch ? patch.entityId : patchKind(patch)}`;
	showToast(peerId, toastId, message, icon);
}

/** Remote realtime Transform drag (authoring channel). */
export function notifyPeerAuthoringEdit(
	peerId: string,
	patch: DurablePatch,
	wireName = ''
) {
	if (!isFieldPatch(patch) || patch.component !== 'Transform') return;

	const message = `${peerLabel(peerId, wireName)} ${transformVerb(patch.field)} ${shortEntityId(patch.entityId)}`;
	const key = `${peerId}:${patch.entityId}:transform`;
	scheduleToast(
		transformTimers,
		key,
		TRANSFORM_QUIET_MS,
		peerId,
		message,
		`peer-edit:${key}`,
		transformIcon(patch.field)
	);
}

/** Remote runtime spawn (props, etc.). */
export function notifyPeerSpawn(peerId: string, entity: Entity, wireName = '') {
	if (isPlayerEntity(entity)) return;
	const name = peerLabel(peerId, wireName);
	const label = shortEntityId(entity.id);
	const type = entity.type ?? 'entity';
	showToast(
		peerId,
		`peer-spawn:${peerId}:${entity.id}`,
		`${name} added ${type} ${label}`,
		PlusIcon
	);
}

/** Remote runtime despawn. */
export function notifyPeerDespawn(peerId: string, entityId: string, wireName = '') {
	if (entityId.startsWith('entity:player/')) return;
	showToast(
		peerId,
		`peer-despawn:${peerId}:${entityId}`,
		`${peerLabel(peerId, wireName)} removed ${shortEntityId(entityId)}`,
		Trash2Icon
	);
}

export function resetPeerEditToasts() {
	for (const timer of transformTimers.values()) clearTimeout(timer);
	for (const timer of fieldTimers.values()) clearTimeout(timer);
	transformTimers.clear();
	fieldTimers.clear();
}

function formatDurableMessage(
	peerId: string,
	patch: DurablePatch,
	wireName: string
): { message: string; icon: typeof PencilIcon } | null {
	const name = peerLabel(peerId, wireName);
	const kind = patchKind(patch);

	switch (kind) {
		case 'setField': {
			if (!isFieldPatch(patch)) return null;
			if (patch.entityId === SCENE_SETTINGS_ENTITY_ID) {
				return { message: `${name} updated scene settings`, icon: SettingsIcon };
			}
			const label = shortEntityId(patch.entityId);
			if (patch.component === 'Transform') {
				return {
					message: `${name} ${transformVerb(patch.field)} ${label}`,
					icon: transformIcon(patch.field)
				};
			}
			return {
				message: `${name} set ${label} · ${patch.component}.${patch.field}`,
				icon: PencilIcon
			};
		}
		case 'setComponent':
			if (!isKindPatch(patch, 'setComponent')) return null;
			return {
				message: `${name} added ${patch.component} to ${shortEntityId(patch.entityId)}`,
				icon: PlusIcon
			};
		case 'removeComponent':
			if (!isKindPatch(patch, 'removeComponent')) return null;
			return {
				message: `${name} removed ${patch.component} from ${shortEntityId(patch.entityId)}`,
				icon: MinusIcon
			};
		case 'setEntity':
			if (!isKindPatch(patch, 'setEntity')) return null;
			return {
				message: `${name} edited ${shortEntityId(patch.entityId)}`,
				icon: PencilIcon
			};
		case 'defineType':
			if (!isKindPatch(patch, 'defineType')) return null;
			return {
				message: `${name} saved type ${patch.name}`,
				icon: ShapesIcon
			};
		default:
			return null;
	}
}
