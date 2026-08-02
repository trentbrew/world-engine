/**
 * Semantic descriptions for animation clips — authoring agents (and humans)
 * can pick clips from text without watching every preview.
 */
import type { CatalogClip } from '$lib/engine/animation/clipCatalog';

/** Curated blurbs for mesh2motion-human / common Mixamo-style ids. */
const CURATED: Record<string, string> = {
	TPose: 'Neutral T-pose reference. Use for bind-pose checks, not gameplay.',
	Idle_Loop: 'Standing idle loop — default biped rest / waiting state.',
	Walk_Loop: 'Forward walk cycle. Standard locomotion at walking speed.',
	Walk_Formal_Loop: 'Formal / stiff walk cycle. Ceremonial or cautious gait.',
	Jog_Fwd_Loop: 'Forward jog cycle. Mid-speed locomotion between walk and sprint.',
	Sprint_Loop: 'Full sprint cycle. Fastest grounded locomotion.',
	Crouch_Idle_Loop: 'Crouched idle loop. Low-profile waiting / stealth rest.',
	Crouch_Fwd_Loop: 'Crouched forward move. Stealth or cover locomotion.',
	Swim_Idle_Loop: 'Treading-water idle. Aquatic rest pose.',
	Swim_Fwd_Loop: 'Forward swim stroke cycle. Aquatic locomotion.',
	Jump_Start: 'Jump takeoff. One-shot launch into the air.',
	Jump_Loop: 'In-air jump hold / fall loop while airborne.',
	Jump_Land: 'Landing recovery after a jump. One-shot impact settle.',
	NinjaJump_Idle_Loop: 'Ninja aerial idle — used as double-jump in-air hold.',
	NinjaJump_Start: 'Ninja jump takeoff — used for double jump.',
	NinjaJump_Land: 'Ninja landing recovery — used after a double jump.',
	Roll: 'Forward dodge / recovery roll. One-shot action.',
	Roll_RM: 'Forward roll with root motion travel baked in.',
	Interact: 'Generic reach / interact gesture. One-shot use / activate.',
	PickUp_Table: 'Pick-up from table height. One-shot grab from waist–chest level.',
	Push_Loop: 'Pushing against a surface or object. Looping effort.',
	Driving_Loop: 'Seated driving pose / wheel hold. Vehicle idle loop.',
	Death01: 'Death / collapse reaction (variant 01). One-shot fail state.',
	Punch_Jab: 'Lead jab punch. Short-range melee attack.',
	Punch_Cross: 'Cross punch. Heavier melee strike than a jab.',
	Sword_Idle: 'Sword-ready idle. Combat stance with blade drawn.',
	Sword_Attack: 'Sword swing attack. One-shot melee strike.',
	Sword_Attack_RM: 'Sword attack with root motion travel baked in.',
	Pistol_Idle_Loop: 'Pistol-ready idle. Aim / hold firearm stance.',
	Pistol_Shoot: 'Pistol fire. One-shot shoot recoil.',
	Pistol_Reload: 'Pistol reload. One-shot magazine change.',
	Idle_Talking_Loop: 'Talking idle with conversational gesture. Social loop.',
	Dance_Loop: 'Celebratory dance loop. Emote / party locomotion.',
	Bow: 'Formal bow. One-shot greeting or respect gesture.',
	Sitting_Enter: 'Sit-down transition. One-shot enter seated state.',
	Sitting_Idle_Loop: 'Seated idle loop. Chair / bench rest.',
	Sitting_Exit: 'Stand-up from sit. One-shot exit seated state.',
	Angry: 'Angry emote. Frustrated / hostile expression.',
	Spell_Simple_Idle_Loop: 'Spell-casting ready idle. Magic stance loop.',
	Spell_Simple_Shoot: 'Cast / release a simple spell. One-shot magic attack.',
	idle: 'Standing idle. Default rest / waiting state.',
	walk: 'Forward walk cycle. Standard locomotion.',
	run: 'Forward run cycle. Fast grounded locomotion.',
	agree: 'Agree / nod gesture. Affirmative social cue.',
	headShake: 'Head shake / disagree. Negative social cue.',
	sad_pose: 'Sad emotional pose. Melancholy hold.',
	sneak_pose: 'Sneak / crouch-ready pose. Stealth hold.'
};

const CATEGORY_HINT: Record<string, string> = {
	locomotion: 'Locomotion cycle for character movement.',
	action: 'One-shot action / interaction clip.',
	combat: 'Combat attack, reload, or weapon stance.',
	social: 'Social / conversational gesture.',
	emote: 'Emotional expression or reaction.',
	magic: 'Spell-casting or magical ability.',
	pose: 'Held pose / reference stance.',
	gesture: 'Hand / body gesture.',
	embedded: 'Clip embedded in the model GLB.'
};

function prettyId(id: string): string {
	return id.replace(/_/g, ' ').replace(/\bRM\b/g, 'root-motion');
}

/** Human- and agent-readable description for a catalog clip. */
export function describeClip(clip: Pick<CatalogClip, 'id' | 'category' | 'description' | 'loop' | 'rootMotion' | 'dur'>): string {
	if (clip.description?.trim()) return clip.description.trim();

	const curated = CURATED[clip.id];
	if (curated) return curated;

	const parts: string[] = [];
	const cat = clip.category?.toLowerCase();
	if (cat && CATEGORY_HINT[cat]) parts.push(CATEGORY_HINT[cat]);
	else parts.push(`Animation clip “${prettyId(clip.id)}”.`);

	if (clip.loop === true) parts.push('Loops.');
	else if (clip.loop === false) parts.push('One-shot.');
	if (clip.rootMotion) parts.push('Includes root motion.');
	if (typeof clip.dur === 'number' && clip.dur > 0) {
		parts.push(`~${clip.dur.toFixed(1)}s.`);
	}

	return parts.join(' ');
}

/** Search haystack: id + category + description. */
export function clipSearchText(clip: CatalogClip): string {
	return [clip.id, clip.category ?? '', describeClip(clip)].join(' ').toLowerCase();
}
