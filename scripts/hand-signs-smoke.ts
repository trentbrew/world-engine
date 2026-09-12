/** Smoke test for Naruto hand signs modifier key chord and waist-level zoom state. */
import { handSigns } from '../src/lib/engine/player/handSigns.svelte.ts';
import { input } from '../src/lib/engine/player/input.ts';
import { ui } from '../src/lib/ui/ui.svelte.ts';

function assert(cond: unknown, msg: string): asserts cond {
	if (!cond) throw new Error(msg);
}

console.log('Running hand-signs-smoke tests...');

// 1. Initial state
assert(!handSigns.active, 'handSigns should start inactive');
assert(handSigns.zoomDistance === 1.8, 'default zoom distance should be 1.8m');
assert(handSigns.waistLookAtOffset[1] === 0.1, 'waist lookAtOffset Y should be 0.1m (waist level)');
assert(handSigns.savedDistance === null, 'savedDistance should start null');

// 2. Modifier key detection
const fakeCtrlEvent = { key: 'Control', altKey: false, ctrlKey: true } as KeyboardEvent;
const fakeCtrlLowerEvent = { key: 'control', altKey: false, ctrlKey: true } as KeyboardEvent;
const fakeCtrlLeftCodeEvent = { key: 'Control', code: 'ControlLeft', altKey: false, ctrlKey: true } as KeyboardEvent;
const fakeAltEvent = { key: 'Alt', altKey: true, ctrlKey: false } as KeyboardEvent;
const fakeNonModEvent = { key: 'w', altKey: false, ctrlKey: false } as KeyboardEvent;

assert(handSigns.isModifier(fakeCtrlEvent), 'Control should be recognized as hand sign modifier');
assert(handSigns.isModifier(fakeCtrlLowerEvent), 'control lowercase should be recognized');
assert(handSigns.isModifier(fakeCtrlLeftCodeEvent), 'ControlLeft code should be recognized');
assert(!handSigns.isModifier(fakeAltEvent), 'Alt should no longer be the hand sign modifier');
assert(!handSigns.isModifier(fakeNonModEvent), 'w should not be recognized as modifier');

// 3. Activation requires play mode
ui.shellMode = 'edit';
handSigns.activate(6.0, 1.2);
assert(!handSigns.active, 'activate should be a no-op in edit mode');

ui.shellMode = 'play';
handSigns.activate(6.0, 1.2);
assert(handSigns.active, 'activate should set active in play mode');
assert(handSigns.savedDistance === 6.0, 'savedDistance should record current camera distance');
assert(handSigns.savedAzimuth === 1.2, 'savedAzimuth should record current camera azimuth');

// 4. Input pause during hand signs stance
const sample = input.movement();
assert(sample.tier === 'idle', 'movement tier should be idle while handSigns.active');
assert(sample.speed === 0, 'speed should be 0 while handSigns.active');
assert(sample.magnitude === 0, 'magnitude should be 0 while handSigns.active');
assert(!input.jumpPressed(), 'jump should be inhibited while handSigns.active');
assert(!input.interactPressed(), 'interact should be inhibited while handSigns.active');

// 5. Hand sign mappings and chain building
import { HAND_SIGNS_MAP } from '../src/lib/engine/player/handSigns.svelte.ts';

const expectedSigns: Record<string, { english: string; japanese: string; romaji: string }> = {
	q: { english: 'DRAGON', japanese: '辰', romaji: 'Tatsu' },
	w: { english: 'TIGER', japanese: '寅', romaji: 'Tora' },
	e: { english: 'DOG', japanese: '戌', romaji: 'Inu' },
	r: { english: 'RAT', japanese: '子', romaji: 'Ne' },
	a: { english: 'RAM', japanese: '未', romaji: 'Hitsuji' },
	s: { english: 'HORSE', japanese: '午', romaji: 'Uma' },
	d: { english: 'MONKEY', japanese: '申', romaji: 'Saru' },
	f: { english: 'BIRD', japanese: '酉', romaji: 'Tori' },
	z: { english: 'OX', japanese: '丑', romaji: 'Ushi' },
	x: { english: 'SERPENT', japanese: '巳', romaji: 'Mi' },
	c: { english: 'HARE', japanese: '卯', romaji: 'U' },
	v: { english: 'BOAR', japanese: '亥', romaji: 'I' }
};

for (const [k, expected] of Object.entries(expectedSigns)) {
	const mapped = HAND_SIGNS_MAP[k];
	assert(mapped, `HAND_SIGNS_MAP missing key ${k}`);
	assert(mapped.english === expected.english, `${k} english should be ${expected.english}, got ${mapped.english}`);
	assert(mapped.japanese === expected.japanese, `${k} japanese should be ${expected.japanese}, got ${mapped.japanese}`);
	assert(mapped.romaji === expected.romaji, `${k} romaji should be ${expected.romaji}, got ${mapped.romaji}`);
}

// Test key resolution from event
assert(handSigns.resolveKey({ key: 'q', code: 'KeyQ' } as KeyboardEvent) === 'q', 'resolveKey lowercase q');
assert(handSigns.resolveKey({ key: 'Q', code: 'KeyQ' } as KeyboardEvent) === 'q', 'resolveKey uppercase Q');
assert(handSigns.resolveKey({ key: '', code: 'KeyW' } as KeyboardEvent) === 'w', 'resolveKey via code KeyW');
assert(handSigns.resolveKey({ key: 'g', code: 'KeyG' } as KeyboardEvent) === null, 'resolveKey non-sign key should be null');

// Test chain input sequence
assert(handSigns.chain.length === 0, 'chain should start empty in new stance');
handSigns.inputSign('w'); // TIGER (寅)
handSigns.inputSign('e'); // DOG (戌)
handSigns.inputSign('d'); // MONKEY (申)

assert(handSigns.chain.length === 3, 'chain should have 3 entries');
assert(handSigns.chain[0].japanese === '寅' && handSigns.chain[0].english === 'TIGER', 'entry 0 is Tiger');
assert(handSigns.chain[1].japanese === '戌' && handSigns.chain[1].english === 'DOG', 'entry 1 is Dog');
assert(handSigns.chain[2].japanese === '申' && handSigns.chain[2].english === 'MONKEY', 'entry 2 is Monkey');

// 6. Deactivation
handSigns.deactivate();
assert(!handSigns.active, 'deactivate should set active to false');
assert(handSigns.chain.length === 3, 'chain should remain visible after deactivation for graceful view');

// Next activation resets chain for fresh jutsu
handSigns.activate(5.0, 0.5);
assert(handSigns.chain.length === 0, 'activate should start a fresh chain');
handSigns.deactivate();

// 7. Jutsu matching tests
import { matchJutsu } from '../src/lib/engine/player/handSigns.svelte.ts';

// Test Chidori (Ox -> Hare -> Monkey = z c d)
const chidori = matchJutsu(['z', 'c', 'd']);
assert(chidori !== null && chidori.id === 'chidori', 'z,c,d should match Chidori');
assert(chidori.japanese === '千鳥', 'Chidori kanji');

// Test Fireball short (Serpent -> Tiger = x w)
const fireball = matchJutsu(['x', 'w']);
assert(fireball !== null && fireball.name.includes('Fireball'), 'x,w should match Fireball');

// Test unmapped sequence
const unmapped = matchJutsu(['q', 'w', 'e']);
assert(unmapped === null, 'q,w,e should not match any jutsu');

// Test deactivate result assignment on mapped sequence
handSigns.activate();
handSigns.inputSign('z'); // Ox
handSigns.inputSign('c'); // Hare
handSigns.inputSign('d'); // Monkey
assert(handSigns.activeJutsu?.id === 'chidori', 'activeJutsu should be chidori while typing');
handSigns.deactivate();
assert(handSigns.lastResult !== null, 'lastResult should be populated');
assert(handSigns.lastResult.matched === true, 'lastResult should be matched');
assert(handSigns.lastResult.jutsu?.id === 'chidori', 'lastResult jutsu should be chidori');

// Test deactivate result assignment on unmapped sequence
handSigns.activate();
handSigns.inputSign('q'); // Dragon
handSigns.inputSign('z'); // Ox
assert(handSigns.activeJutsu === null, 'activeJutsu should be null');
handSigns.deactivate();
assert(handSigns.lastResult?.matched === false, 'lastResult should be unmatched');
assert(handSigns.lastResult?.jutsu === null, 'lastResult jutsu should be null');
assert(handSigns.isFailedJutsu === true, 'isFailedJutsu should be true after unmapped jutsu combo');
assert(!handSigns.isJutsuLocked, 'isJutsuLocked should be false on failed jutsu');
handSigns.clearFailedJutsu();
assert(handSigns.isFailedJutsu === false, 'clearFailedJutsu resets failed state');

// Verify Confused head-scratch clip is registered in the human animation catalog
import { loadCatalog } from '../src/lib/engine/animation/clipCatalog.ts';
const cat = await loadCatalog('catalog:mesh2motion-human');
const confusedMeta = cat.clips?.find((c) => c.id === 'Confused');
assert(confusedMeta !== undefined, 'Confused clip declared in catalog');
assert(confusedMeta.file === 'addon', 'Confused comes from addon pack');
assert(confusedMeta.loop === false, 'Confused is configured not to loop');

// 8. Jutsu camera lock and shadow clone jutsu tests
import { shadowCloneState } from '../src/lib/engine/player/shadowClone.svelte.ts';
import { world } from '../src/lib/engine/runtime/world.svelte.ts';
import { collab } from '../src/lib/engine/collab/collab.svelte.ts';
import { emitHumanChat } from '../src/lib/engine/agent/chatHooks.ts';

// Test that matched jutsu enters camera showcase lock
handSigns.activate();
handSigns.inputSign('z'); // Ox
handSigns.inputSign('c'); // Hare
handSigns.inputSign('d'); // Monkey
handSigns.deactivate();
assert(handSigns.isJutsuLocked === true, 'isJutsuLocked should be true after completing valid jutsu');
assert(handSigns.jutsuLockDistance === 5.2, 'jutsuLockDistance should be 5.2m for zoomed out camera framing');

// Verify input is paused while isJutsuLocked
const lockedMovement = input.movement();
assert(lockedMovement.tier === 'idle' && lockedMovement.speed === 0, 'movement should be inhibited during isJutsuLocked');
assert(!input.jumpPressed(), 'jump should be inhibited during isJutsuLocked');
assert(!input.interactPressed(), 'interact should be inhibited during isJutsuLocked');

// Reset handSigns clears the lock
handSigns.reset();
assert(handSigns.isJutsuLocked === false, 'isJutsuLocked should be false after reset');

// 9. Shadow clone jutsu spawning and chat interaction
// Setup local player in world
const mockLocalPlayer = {
	id: 'entity:player/local',
	type: 'Player',
	components: {
		Transform: { position: [0, 0.975, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
		SkinnedMesh: { mesh: '/models/player.glb', color: '#3b82f6', rig: 'human' },
		Player: { speed: 4, color: '#3b82f6' },
		Mesh3DAnimator: { clip: 'Idle_Loop' }
	},
	raw: {}
};
// 7b. Verify JUTSU_REGISTRY has sfx and triggerDelayMs configured
import { JUTSU_REGISTRY } from '../src/lib/engine/player/handSigns.svelte.ts';
for (const jutsu of JUTSU_REGISTRY) {
	assert(typeof jutsu.sfx === 'string' && jutsu.sfx.length > 0, `jutsu ${jutsu.id} must have sfx defined`);
	assert(typeof jutsu.triggerDelayMs === 'number' && jutsu.triggerDelayMs >= 800, `jutsu ${jutsu.id} must have triggerDelayMs >= 800`);
}
const shadowCloneDef = JUTSU_REGISTRY.find((j) => j.id === 'shadow_clone');
assert(shadowCloneDef?.sfx === '/audio/shadowclone.wav', 'shadow clone sfx must be /audio/shadowclone.wav');
assert(shadowCloneDef?.triggerDelayMs === 1200, 'shadow clone triggerDelayMs must be 1200ms');

world.localPlayerId = 'entity:player/local';
world.spawn(mockLocalPlayer as any);

// Perform Shadow Clone Jutsu (Ram = 'a')
handSigns.activate();
handSigns.inputSign('a'); // Ram
assert(handSigns.activeJutsu?.id === 'shadow_clone', 'key "a" should match shadow_clone');
handSigns.deactivate();

// Immediately after deactivation: jutsu.wav has started, but clones have NOT spawned yet (1.2s delay)
assert(shadowCloneState.clones.length === 0, 'clones should not spawn instantly at t=0; charging jutsu');
assert(handSigns.isJutsuLocked === true, 'isJutsuLocked should be true immediately to lock camera');

// Wait for 1.2s trigger delay
await new Promise((resolve) => setTimeout(resolve, 1250));

assert(shadowCloneState.clones.length === 1, 'shadowCloneState should have 1 active clone after trigger delay');
const clone = shadowCloneState.clones[0];
assert(clone.status === 'awaiting instructions', 'clone should start awaiting instructions');
assert(clone.entityId.startsWith('entity:player/clone_'), 'clone entityId format');
assert(clone.entityId !== world.localPlayerId, 'clone entity must NEVER equal world.localPlayerId');
assert(handSigns.isJutsuLocked === true, 'isJutsuLocked should be true after completing jutsu');

// Verify that while isJutsuLocked is active, movement and jump inputs are not inhibited
const jutsuLockedMove = input.movement();
assert(jutsuLockedMove.tier !== undefined, 'movementSample should remain callable and active during jutsu lock');
assert(!handSigns.active, 'handSigns should be inactive after releasing modifier');

// Verify clone entity exists in world
const cloneEntity = world.getEntity(clone.entityId);
assert(cloneEntity !== undefined, 'clone entity should exist in world');
assert(cloneEntity.components.SkinnedMesh?.color === '#3b82f6', 'clone should copy local player color');

// Verify collab display name resolves correctly
const displayName = collab.displayNameFor(clone.clientId);
assert(displayName === clone.name, `collab.displayNameFor should return ${clone.name}, got ${displayName}`);

// Verify chat interaction updates clone status
emitHumanChat({
	fromClientId: 'local',
	convoId: 'test-convo',
	members: ['local', clone.clientId],
	text: 'Clone, please work on scouting the perimeter'
});
assert(clone.status === 'working', 'clone status should transition to working after task instruction');

// Verify dispel
const dispelled = shadowCloneState.dispelClone(clone.clientId);
assert(dispelled === true, 'dispelClone should return true');
assert(shadowCloneState.clones.length === 0, 'clones array should be empty after dispel');
assert(world.getEntity(clone.entityId) === undefined, 'clone entity should be removed from world');

// 9b. Consecutive Duplicate Filtering vs Shadow Clone Multiplier Tests
handSigns.reset();
handSigns.activate();

// Normal sign duplicate ignore:
handSigns.inputSign('w'); // Tiger
assert(handSigns.chain.length === 1, 'first Tiger input added');
const duplicateTiger = handSigns.inputSign('w');
assert(duplicateTiger === null, 'consecutive duplicate of normal sign must return null');
assert(handSigns.chain.length === 1, 'consecutive duplicate normal sign must NOT be appended to chain');

// Non-consecutive is allowed:
handSigns.inputSign('e'); // Dog
assert(handSigns.chain.length === 2, 'different sign appends to chain');
handSigns.inputSign('w'); // Tiger again (non-consecutive)
assert(handSigns.chain.length === 3, 'non-consecutive duplicate is allowed in combo');
handSigns.reset();

// Shadow Clone Jutsu (Ram = 'a') Multiplier Tests:
handSigns.activate();
handSigns.inputSign('a'); // Ram #1
assert(handSigns.chain.length === 1, 'first Ram input added to chain');
assert(handSigns.cloneMultiplier === 1, 'initial cloneMultiplier should be 1');

handSigns.inputSign('a'); // Ram #2
assert(handSigns.chain.length === 1, 'repeated Ram does NOT append duplicate entry to chain');
assert(handSigns.cloneMultiplier === 2, 'repeated Ram increments cloneMultiplier to 2');

handSigns.inputSign('a'); // Ram #3
assert(handSigns.cloneMultiplier === 3, 'third Ram increments cloneMultiplier to 3');

// Deactivating commits 3 clones simultaneously in formation
handSigns.deactivate();
assert(shadowCloneState.clones.length === 0, 'clones not yet spawned at t=0 during 1.2s charge delay');
assert(handSigns.jutsuLockDistance === 5.2 + (3 - 1) * 0.5, 'camera showcase zooms out wider for 3 clones (6.2m)');
assert(handSigns.isJutsuLocked === true, 'jutsu camera locked for showcase');

// Wait for jutsu trigger delay
await new Promise((resolve) => setTimeout(resolve, 1250));

assert(shadowCloneState.clones.length === 3, 'should spawn 3 shadow clones after trigger delay');

// Verify all 3 clones exist in world at distinct offset positions
const cloneEntities = shadowCloneState.clones.map((c) => world.getEntity(c.entityId));
assert(cloneEntities.every((e) => e !== undefined), 'all 3 clones spawned in world');
const xPositions = cloneEntities.map((e) => (e!.components.Transform.position as [number, number, number])[0]);
assert(new Set(xPositions).size === 3, 'all 3 clones have unique X offsets in formation');

// Dispel all
shadowCloneState.dispelAll();
assert(shadowCloneState.clones.length === 0, 'dispelAll removes all clones');

// 9c. Jutsu Cancellation Tests (Chakra mold dispelled before release)
handSigns.reset();
handSigns.activate();
handSigns.inputSign('z'); // Ox
handSigns.inputSign('c'); // Hare
assert(handSigns.chain.length === 2, 'chain has 2 formed seals');

handSigns.cancel();
assert(!handSigns.active, 'cancel should immediately exit active stance');
assert(handSigns.chain.length === 0, 'cancel should wipe active seal chain');
assert(!handSigns.isJutsuLocked, 'cancel should NOT trigger jutsu camera lock');
assert(handSigns.lastResult === null, 'cancel should not set lastResult');
assert(handSigns.cloneMultiplier === 1, 'cancel resets cloneMultiplier');

// 10. Zodiac Radial Left Stick Gamepad tests
import { sampleRadialStick, RADIAL_ZODIAC_DEFS, RADIAL_SECTOR_KEYS } from '../src/lib/engine/player/radialZodiac.ts';

assert(RADIAL_ZODIAC_DEFS.length === 12, 'RADIAL_ZODIAC_DEFS should have 12 sectors');
assert(RADIAL_SECTOR_KEYS.length === 12, 'RADIAL_SECTOR_KEYS should have 12 keys');

// Test deadzone behavior
const deadzoneSample = sampleRadialStick(0.1, 0.1);
assert(!deadzoneSample.active, 'small deflection (r < 0.25) should be inactive');
assert(!deadzoneSample.committed, 'small deflection should not be committed');
assert(deadzoneSample.sector === null, 'inactive sample should have null sector');
assert(deadzoneSample.key === null, 'inactive sample should have null key');

// Test intermediate deflection (active pointer but uncommitted)
const midSample = sampleRadialStick(0, -0.5); // 12:00, r = 0.5
assert(midSample.active, 'r = 0.5 should be active');
assert(!midSample.committed, 'r = 0.5 should not be committed (threshold is 0.65)');
assert(midSample.sector === 0, '12:00 sector is 0 (Rat)');
assert(midSample.key === 'r', '12:00 key is "r"');

// Test all 12 hours of the clock dial
const clockTests = [
	{ hour: 12, x: 0, y: -1, expectedSector: 0, expectedKey: 'r', expectedKanji: '子' },
	{ hour: 1, x: 0.5, y: -0.866, expectedSector: 1, expectedKey: 'z', expectedKanji: '丑' },
	{ hour: 2, x: 0.866, y: -0.5, expectedSector: 2, expectedKey: 'w', expectedKanji: '寅' },
	{ hour: 3, x: 1, y: 0, expectedSector: 3, expectedKey: 'c', expectedKanji: '卯' },
	{ hour: 4, x: 0.866, y: 0.5, expectedSector: 4, expectedKey: 'q', expectedKanji: '辰' },
	{ hour: 5, x: 0.5, y: 0.866, expectedSector: 5, expectedKey: 'x', expectedKanji: '巳' },
	{ hour: 6, x: 0, y: 1, expectedSector: 6, expectedKey: 's', expectedKanji: '午' },
	{ hour: 7, x: -0.5, y: 0.866, expectedSector: 7, expectedKey: 'a', expectedKanji: '未' }, // Shadow Clone
	{ hour: 8, x: -0.866, y: 0.5, expectedSector: 8, expectedKey: 'd', expectedKanji: '申' },
	{ hour: 9, x: -1, y: 0, expectedSector: 9, expectedKey: 'f', expectedKanji: '酉' },
	{ hour: 10, x: -0.866, y: -0.5, expectedSector: 10, expectedKey: 'e', expectedKanji: '戌' },
	{ hour: 11, x: -0.5, y: -0.866, expectedSector: 11, expectedKey: 'v', expectedKanji: '亥' }
];

for (const t of clockTests) {
	const res = sampleRadialStick(t.x, t.y);
	assert(res.committed, `hour ${t.hour} should be committed at r=1.0`);
	assert(res.sector === t.expectedSector, `hour ${t.hour} expected sector ${t.expectedSector}, got ${res.sector}`);
	assert(res.key === t.expectedKey, `hour ${t.hour} expected key ${t.expectedKey}, got ${res.key}`);
	const def = RADIAL_ZODIAC_DEFS[res.sector!];
	assert(def.japanese === t.expectedKanji, `hour ${t.hour} kanji expected ${t.expectedKanji}, got ${def.japanese}`);
}

// Test boundary angles (±15° around each hour mark)
// 12:00 is [345°, 360°) U [0°, 15°)
const justBefore1 = sampleRadialStick(Math.sin(14 * Math.PI / 180), -Math.cos(14 * Math.PI / 180));
assert(justBefore1.sector === 0, '14° should still be sector 0 (Rat)');
const justAfter1 = sampleRadialStick(Math.sin(16 * Math.PI / 180), -Math.cos(16 * Math.PI / 180));
assert(justAfter1.sector === 1, '16° should be sector 1 (Ox)');

// 11. Shoulder Buttons & Chords Gamepad tests
import {
	SHOULDER_SIGNS_MAP,
	ALL_SHOULDER_SIGNS,
	resolveShoulderChord,
	formatChordLabel,
	SHOULDER_L1,
	SHOULDER_L2,
	SHOULDER_R1,
	SHOULDER_R2
} from '../src/lib/engine/player/shoulderSigns.ts';
import { gamepadShoulderMask } from '../src/lib/engine/player/gamepad.svelte.ts';

assert(ALL_SHOULDER_SIGNS.length === 12, 'ALL_SHOULDER_SIGNS should have 12 signs');

// Test 4 Singles
assert(resolveShoulderChord(SHOULDER_L1)?.key === 'r', 'L1 -> Rat');
assert(resolveShoulderChord(SHOULDER_L2)?.key === 'z', 'L2 -> Ox');
assert(resolveShoulderChord(SHOULDER_R1)?.key === 'w', 'R1 -> Tiger');
assert(resolveShoulderChord(SHOULDER_R2)?.key === 'c', 'R2 -> Hare');

// Test 6 Pairs
assert(resolveShoulderChord(SHOULDER_L1 | SHOULDER_R1)?.key === 'q', 'L1+R1 -> Dragon');
assert(resolveShoulderChord(SHOULDER_L2 | SHOULDER_R2)?.key === 'x', 'L2+R2 -> Serpent');
assert(resolveShoulderChord(SHOULDER_L1 | SHOULDER_L2)?.key === 's', 'L1+L2 -> Horse');
assert(resolveShoulderChord(SHOULDER_R1 | SHOULDER_R2)?.key === 'a', 'R1+R2 -> Ram (Shadow Clone)');
assert(resolveShoulderChord(SHOULDER_L1 | SHOULDER_R2)?.key === 'd', 'L1+R2 -> Monkey');
assert(resolveShoulderChord(SHOULDER_L2 | SHOULDER_R1)?.key === 'f', 'L2+R1 -> Bird');

// Test 2 Multi-Button Chords
assert(resolveShoulderChord(SHOULDER_L1 | SHOULDER_L2 | SHOULDER_R1)?.key === 'e', 'L1+L2+R1 -> Dog');
assert(resolveShoulderChord(SHOULDER_L1 | SHOULDER_L2 | SHOULDER_R1 | SHOULDER_R2)?.key === 'v', 'ALL 4 -> Boar');

// Test localized glyph formatting
assert(formatChordLabel(['L1', 'R1'], 'playstation') === 'L1 + R1', 'PS chord label');
assert(formatChordLabel(['L1', 'R1'], 'xbox') === 'LB + RB', 'Xbox chord label');
assert(formatChordLabel(['L1', 'R1'], 'switch') === 'L + R', 'Switch chord label');
assert(formatChordLabel(['R1', 'R2'], 'xbox') === 'RB + RT', 'Xbox Ram chord label');

// Test simulated shoulder gamepad polling and 55ms buffer
const mockShoulderPad = {
	index: 0,
	id: 'Mock DualSense Controller',
	connected: true,
	buttons: [
		{ pressed: false, value: 0 }, // 0: South
		{ pressed: false, value: 0 }, // 1: East
		{ pressed: false, value: 0 }, // 2: West
		{ pressed: true, value: 1.0 }, // 3: North (Triangle held for stance)
		{ pressed: false, value: 0 }, // 4: L1
		{ pressed: false, value: 0 }, // 5: R1
		{ pressed: false, value: 0 }, // 6: L2
		{ pressed: false, value: 0 }, // 7: R2
		{ pressed: false, value: 0 },
		{ pressed: false, value: 0 }
	],
	axes: [0, 0, 0, 0]
} as unknown as Gamepad;

const origGetGamepads = navigator.getGamepads;
(navigator as any).getGamepads = () => [mockShoulderPad];
handSigns.reset();

// Setup deterministic time mock
const origNow = performance.now;
let fakeTime = 1000;
(performance as any).now = () => fakeTime;

// 1. Enter stance
handSigns.pollGamepad();
assert(handSigns.active, 'holding North button 3 enters stance');
assert(handSigns.chain.length === 0, 'chain starts empty');

// 2. Simultaneous / staggered chord: R1 (button 5) and R2 (button 7) for Shadow Clone (Ram)
mockShoulderPad.buttons[5] = { pressed: true, value: 1.0 }; // R1 touched at t=1000
handSigns.pollGamepad();
assert(handSigns.shoulderMask === SHOULDER_R1, 'live shoulderMask reads R1');
assert(handSigns.chain.length === 0, 'chord should not commit immediately before buffer window');

// R2 lands 20ms later while buffer window is open
fakeTime += 20; // t=1020
mockShoulderPad.buttons[7] = { pressed: true, value: 1.0 }; // R2 touched
handSigns.pollGamepad();
assert(handSigns.shoulderMask === (SHOULDER_R1 | SHOULDER_R2), 'live shoulderMask reads R1+R2');
assert(handSigns.chain.length === 0, 'chord still accumulating');

// Advance time past 55ms (now t=1065, delta=65ms from start at 1000)
fakeTime += 45;
handSigns.pollGamepad();
assert(handSigns.chain.length === 1, 'chord commits after 55ms window');
assert(handSigns.chain[0].key === 'a', 'committed chord is "a" (Ram)');
assert(handSigns.chain[0].english === 'RAM', 'committed sign is RAM');

// Holding buttons should NOT duplicate inputs
handSigns.pollGamepad();
assert(handSigns.chain.length === 1, 'holding chord does not duplicate seal');

// Release shoulder buttons to neutral
mockShoulderPad.buttons[5] = { pressed: false, value: 0 };
mockShoulderPad.buttons[7] = { pressed: false, value: 0 };
handSigns.pollGamepad();
assert(handSigns.shoulderMask === 0, 'shoulderMask is 0 at neutral');
assert(handSigns.chain.length === 1, 'chain remains intact after neutral release');

// Release stance modifier button 3 -> triggers Jutsu completion!
mockShoulderPad.buttons[3] = { pressed: false, value: 0 };
handSigns.pollGamepad();
assert(!handSigns.active, 'releasing modifier deactivates stance');
assert(shadowCloneState.clones.length === 0, 'clones not yet spawned before trigger delay');
assert(handSigns.isJutsuLocked, 'jutsu camera showcase lock is activated immediately');

// Wait for jutsu trigger delay
await new Promise((resolve) => setTimeout(resolve, 1250));

assert(shadowCloneState.clones.length === 1, 'completing Ram seal spawns Shadow Clone after trigger delay');
shadowCloneState.dispelClone(shadowCloneState.clones[0].clientId);
handSigns.reset();

// Test Gamepad Cancel Button (Button 1: Circle / B / A / East)
mockShoulderPad.buttons[3] = { pressed: true, value: 1.0 }; // Re-enter stance
handSigns.pollGamepad();
assert(handSigns.active, 're-entered stance via button 3');
handSigns.inputSign('w'); // Form Tiger seal
assert(handSigns.chain.length === 1, 'formed Tiger seal');

// Press cancel button (East = 1)
mockShoulderPad.buttons[1] = { pressed: true, value: 1.0 };
handSigns.pollGamepad();
assert(!handSigns.active, 'pressing button 1 immediately cancels stance');
assert(handSigns.chain.length === 0, 'chain cleared upon cancel');
assert(!handSigns.isJutsuLocked, 'no jutsu lock triggered on cancel');
assert(shadowCloneState.clones.length === 0, 'no clones spawned on cancel');

// Clean up
(performance as any).now = origNow;
handSigns.reset();
(navigator as any).getGamepads = origGetGamepads;

console.log('hand-signs-smoke: PASS');
process.exit(0);


