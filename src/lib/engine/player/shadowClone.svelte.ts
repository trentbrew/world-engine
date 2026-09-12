/**
 * Naruto Shadow Clone Jutsu (Kage Bunshin no Jutsu) state manager.
 *
 * Spawns an exact clone of the local player entity beside them, registers
 * them as an interactable peer for walk-up proximity chat ("Press E to talk"),
 * tracks their current task status (e.g. "awaiting instructions", "working", "standing by"),
 * and enables quick dispel at any time.
 */

import { world } from '$lib/engine/runtime/world.svelte';
import { session } from '$lib/engine/net/session.svelte';
import { roomChat } from '$lib/engine/collab/roomChat.svelte';
import { toast } from '$lib/ui/toast.svelte';
import { getType } from '$lib/engine/ontology/registry';
import { addHumanChatListener, type HumanChatEvent } from '$lib/engine/agent/chatHooks';
import { warmLocomotionPack } from '$lib/engine/player/playerLocomotionClips';
import type { Entity } from '$lib/engine/ontology/schema';

export type ShadowCloneStatus = 'awaiting instructions' | 'working' | 'standing by';

export interface ShadowClone {
	id: string; // e.g. "clone_1"
	entityId: string; // e.g. "entity:player/clone_1"
	clientId: string; // e.g. "clone_1"
	name: string; // "Shadow Clone #1"
	status: ShadowCloneStatus;
	createdAt: number;
}

class ShadowCloneManager {
	clones = $state<ShadowClone[]>([]);

	private _nextSeq = 0;
	private _chatUnsub: (() => void) | null = null;

	constructor() {
		this._initChatListener();
	}

	private _initChatListener() {
		this._chatUnsub = addHumanChatListener((evt: HumanChatEvent) => {
			this._handleHumanChat(evt);
		});
	}

	/** Resolve a clone's display name if clientId belongs to an active clone. */
	getCloneName(clientId: string): string | null {
		const found = this.clones.find((c) => c.clientId === clientId);
		return found ? found.name : null;
	}

	/** Check if an entity or client ID belongs to a clone. */
	isClone(id: string): boolean {
		return this.clones.some((c) => c.id === id || c.entityId === id || c.clientId === id);
	}

	/**
	 * Spawn a shadow clone beside the local player using the same avatar model and color.
	 */
	spawnClone(opts?: { suppressToast?: boolean }): ShadowClone | null {
		const localId = world.localPlayerId;
		if (!localId) return null;
		const localPlayer = world.getEntity(localId);
		if (!localPlayer) return null;

		const transform = localPlayer.components.Transform as
			| { position?: [number, number, number]; rotation?: [number, number, number, number] }
			| undefined;
		const playerPos = transform?.position ?? [0, 1, 0];
		const playerRot = transform?.rotation ?? [0, 0, 0, 1];

		// Calculate spawn offset beside the player (perpendicular to facing direction)
		const qy = playerRot[1];
		const qw = playerRot[3];
		const yaw = Math.atan2(2 * (qw * qy), 1 - 2 * (qy * qy));
		// Local X offset: 1.2m to the right (or staggered based on clone count)
		const sideOffset = (this.clones.length % 2 === 0 ? 1 : -1) * (1.2 + Math.floor(this.clones.length / 2) * 0.45);
		const offsetX = Math.cos(yaw) * sideOffset;
		const offsetZ = -Math.sin(yaw) * sideOffset;
		const spawnPos: [number, number, number] = [
			playerPos[0] + offsetX,
			playerPos[1],
			playerPos[2] + offsetZ
		];

		const cloneSeq = ++this._nextSeq;
		const clientId = `clone_${cloneSeq}`;
		const entityId = `entity:player/${clientId}`;
		const name = `Shadow Clone #${cloneSeq}`;

		const localSkin = (localPlayer.components.SkinnedMesh ?? {}) as Record<string, unknown>;
		const localPlayerComp = (localPlayer.components.Player ?? {}) as Record<string, unknown>;
		const avatarColor = (localPlayerComp.color as string) ?? (localSkin.color as string) ?? '#d4d4d4';

		const cloneEntity: Entity = {
			id: entityId,
			type: 'Player',
			events: getType('Player')?.events,
			components: {
				Transform: {
					position: spawnPos,
					rotation: playerRot,
					scale: [1, 1, 1]
				},
				SkinnedMesh: {
					mesh: (localSkin.mesh as string) ?? '/models/player.glb',
					anchor: (localSkin.anchor as string) ?? 'bottom',
					rig: (localSkin.rig as string) ?? 'human',
					forwardYaw: (localSkin.forwardYaw as number) ?? 0,
					color: avatarColor,
					capsuleRadiusScale: (localSkin.capsuleRadiusScale as number) ?? 1,
					capsuleHeightScale: (localSkin.capsuleHeightScale as number) ?? 1
				},
				Mesh3DAnimator: {
					catalog: 'catalog:mesh2motion-human',
					clip: 'Idle_Loop',
					speed: 1,
					loop: true,
					rootMotion: false,
					playing: true
				},
				Player: {
					speed: 4,
					color: avatarColor
				},
				Physics: {
					body: 'kinematicPosition',
					collider: 'capsule',
					mass: 70,
					gravityScale: 0
				}
			},
			raw: {}
		};

		warmLocomotionPack(cloneEntity);

		// Register ownership so local client drives or persists the clone
		session.owners[entityId] = session.clientId;
		world.spawn(cloneEntity);
		if (session.connected) {
			session.replicateSpawn(cloneEntity);
		}

		const cloneRecord: ShadowClone = {
			id: clientId,
			entityId,
			clientId,
			name,
			status: 'awaiting instructions',
			createdAt: Date.now()
		};

		this.clones = [...this.clones, cloneRecord];

		if (!opts?.suppressToast) {
			toast.success('影分身の術 Kage Bunshin no Jutsu', {
				description: `${name} summoned. Press E when near to talk.`
			});
		}

		return cloneRecord;
	}

	/**
	 * Spawn multiple shadow clones fanned out in formation beside the local player.
	 */
	spawnClones(count: number = 1): ShadowClone[] {
		const total = Math.max(1, Math.min(12, Math.floor(count)));
		const spawned: ShadowClone[] = [];
		for (let i = 0; i < total; i++) {
			const clone = this.spawnClone({ suppressToast: true });
			if (clone) spawned.push(clone);
		}

		if (spawned.length > 0) {
			const desc = spawned.length === 1
				? `${spawned[0].name} summoned. Press E when near to talk.`
				: `${spawned.length} shadow clones summoned in formation. Press E when near to talk.`;
			toast.success(
				spawned.length === 1
					? '影分身の術 Kage Bunshin no Jutsu'
					: `影分身の術 Kage Bunshin no Jutsu (×${spawned.length})`,
				{ description: desc }
			);
		}
		return spawned;
	}

	/**
	 * Dispel an individual clone by ID or entity ID.
	 */
	dispelClone(idOrClientId: string): boolean {
		const index = this.clones.findIndex(
			(c) => c.id === idOrClientId || c.clientId === idOrClientId || c.entityId === idOrClientId
		);
		if (index === -1) return false;

		const clone = this.clones[index];
		this.clones = this.clones.filter((_, i) => i !== index);

		// Despawn from world
		if (world.getEntity(clone.entityId)) {
			world.despawn(clone.entityId);
			if (session.connected) {
				session.despawnEntity(clone.entityId);
			}
		}
		delete session.owners[clone.entityId];

		// If current chat is with this clone, exit chat
		if (roomChat.open && roomChat.members.includes(clone.clientId)) {
			roomChat.leaveConvo();
		}

		toast.info('Shadow clone dispelled', {
			description: `${clone.name} returned chakra (poof)`
		});

		return true;
	}

	/**
	 * Dispel all currently active clones.
	 */
	dispelAll(): void {
		const copy = [...this.clones];
		for (const clone of copy) {
			this.dispelClone(clone.clientId);
		}
	}

	/**
	 * Update the task status of a clone.
	 */
	setStatus(clientId: string, status: ShadowCloneStatus): void {
		const clone = this.clones.find((c) => c.clientId === clientId);
		if (!clone) return;
		clone.status = status;
		this.clones = [...this.clones];
	}

	/**
	 * Respond to human chat messages in proximity chat.
	 */
	private _handleHumanChat(evt: HumanChatEvent) {
		if (this.clones.length === 0) return;

		// Find if this chat convo includes any of our shadow clones
		const targetClones = this.clones.filter(
			(c) => evt.members.includes(c.clientId) && evt.fromClientId !== c.clientId
		);

		if (targetClones.length === 0) return;

		const prompt = evt.text.toLowerCase().trim();

		for (const clone of targetClones) {
			let reply = '';
			let newStatus: ShadowCloneStatus = clone.status;

			if (prompt.includes('dispel') || prompt.includes('dismiss') || prompt.includes('poof')) {
				reply = `Poof! Returning chakra, Boss!`;
				this.replyInChat(clone, evt.convoId, evt.members, reply);
				setTimeout(() => {
					this.dispelClone(clone.clientId);
				}, 600);
				continue;
			} else if (
				prompt.includes('work') ||
				prompt.includes('task') ||
				prompt.includes('scout') ||
				prompt.includes('guard') ||
				prompt.includes('build') ||
				prompt.includes('help')
			) {
				newStatus = 'working';
				reply = `Understood! I'll get right to work on that, Boss.`;
			} else if (
				prompt.includes('wait') ||
				prompt.includes('standby') ||
				prompt.includes('hold') ||
				prompt.includes('stay')
			) {
				newStatus = 'standing by';
				reply = `Holding position. Let me know when you're ready!`;
			} else if (prompt.includes('hello') || prompt.includes('hi') || prompt.includes('hey')) {
				reply = `Hey Boss! What's the mission?`;
			} else {
				reply = `Shadow Clone on duty! Awaiting instructions.`;
			}

			this.setStatus(clone.clientId, newStatus);
			this.replyInChat(clone, evt.convoId, evt.members, reply);
		}
	}

	/**
	 * Post a chat line as the clone into RoomChat and broadcast over wire.
	 */
	replyInChat(clone: ShadowClone, convoId: string, members: string[], text: string): void {
		setTimeout(() => {
			const message = { text, at: Date.now(), name: clone.name };
			roomChat.ingest(clone.clientId, message, {
				convoId,
				members,
				mine: false
			});
			if (session.connected) {
				session.sendChatAs(text, {
					fromClientId: clone.clientId,
					convoId,
					members,
					displayName: clone.name
				});
			}
		}, 350);
	}
}

export const shadowCloneState = new ShadowCloneManager();
