/**
 * Optional catalog polish for auto-discovered static/games JSON-LD scenes.
 * Drop a world file → it appears in the nav. Override here only when inferred
 * title/description/category/dimensions need a human pass.
 */

export type GameOverride = {
	title?: string;
	description?: string;
	dimensions?: '2d' | '3d';
	category?: 'demo';
};

/** Loaded when `?game=` is missing — see `ensureGameInUrl` / `resolveGame`. */
export const DEFAULT_GAME_PARAM = 'parkour';

/** Scratch world at `/world.jsonld` — pick via `?game=sandbox`. */
export const SANDBOX_GAME = {
	param: 'sandbox',
	title: 'Sandbox',
	description: 'Scratch pad — ground, crates, spawn, lights.',
	dimensions: '3d' as const
};

/**
 * Preferred listing order (params). Anything not listed sorts alphabetically
 * after these; SceneSelector still splits `category: 'demo'` into Demos.
 */
export const GAME_ORDER: string[] = [
	'parkour',
	'craftpunk/commons',
	'powder/slope',
	'orbit',
	'playground',
	'collect',
	'tower',
	'sandbox',
	'blank',
	'blank2d',
	'arena',
	'gallery',
	'circuit',
	'physics',
	'physics-pit',
	'collect-race',
	'platformer2d',
	'collections-demo',
	'rooms-demo',
	'sprites-demo',
	'animated-npc-demo',
	'input-demo',
	'events-demo',
	'alarms-demo',
	'scripts-demo',
	'collision-demo',
	'player-avatar-override'
];

export const GAME_OVERRIDES: Record<string, GameOverride> = {
	'craftpunk/commons': {
		title: 'Craftpunk — Commons',
		description: 'The civic hearth: seed world for the shared, tended commons. Read the manifesto.'
	},
	'powder/slope': {
		title: 'POWDER — Slope',
		description: 'Smoke world for the snowboarding port — a drop-in run with kickers. Second consumer.'
	},
	orbit: {
		title: 'Orbit',
		description: 'Formula-driven orbiting cubes (vec animation, zero code).'
	},
	playground: {
		title: 'Playground',
		description: 'Gravity crates dropping + a pulsing light.'
	},
	collect: {
		title: 'Collect',
		description: 'Walk over the coins to collect them — a real game loop.'
	},
	tower: {
		title: 'Tower',
		description: 'Crates fall and settle into a stack.'
	},
	blank: {
		title: 'Blank',
		description: 'Empty scene — ground, light, and spawn only.'
	},
	blank2d: {
		title: 'Blank 2D',
		description: 'Empty side-view scene — WorldProfile, ground, light, and spawn.',
		dimensions: '2d'
	},
	arena: {
		title: 'Arena',
		description: 'Grid-aligned blocks for multiplayer editing — no physics, pure layout.'
	},
	parkour: {
		title: 'Parkour',
		description: 'Jump across platforms and collect coins along the route.'
	},
	gallery: {
		title: 'Gallery',
		description: 'Formula-driven floaters and pulsing beacons — animation from data.'
	},
	circuit: {
		title: 'Circuit',
		description: 'Oval track with colored gates — sprint laps in play mode.'
	},
	physics: {
		title: 'Physics Lab',
		description: 'Rapier sandbox — ramps, bouncy balls, heavy crates, gravity stacks.'
	},
	'physics-pit': {
		title: 'Physics Pit',
		description: 'Drop into a pit packed with tiny bouncing balls and cubes.'
	},
	'collect-race': {
		title: 'Collect Race',
		description: 'Multiplayer coin dash — first to grab pickups wins the pool (★ score).'
	},
	platformer2d: {
		title: '2D Platformer',
		description: 'Side-view world — WorldProfile, sprites, 2D follow camera.',
		dimensions: '2d'
	},
	'collections-demo': {
		title: 'Collections Demo',
		description: 'Game-global data collections — Heroes + Story Beats with relational links.',
		/** Keep in Scenes (not Demos) despite the `-demo` filename. */
		category: undefined
	},
	'rooms-demo': {
		title: 'Rooms Demo',
		description: 'Two linked rooms (Hall + Vault) — per-room entity sets and room switching.',
		category: 'demo'
	},
	'sprites-demo': {
		title: 'Sprites Demo',
		description: 'Billboard sprites with animator flipbooks — 2D art in a 3D world.',
		category: 'demo'
	},
	'animated-npc-demo': {
		title: 'Animated NPC Demo',
		description: 'Skinned characters looping animation clips with no player input.',
		category: 'demo'
	},
	'input-demo': {
		title: 'Input Demo',
		description: 'Input maps driving entity actions straight from keys and buttons.',
		category: 'demo'
	},
	'events-demo': {
		title: 'Events Demo',
		description: 'Event emitters and listeners wiring reactions across entities.',
		category: 'demo'
	},
	'alarms-demo': {
		title: 'Alarms Demo',
		description: 'Scheduled alarms firing behavior on a timer — logic from data.',
		category: 'demo'
	},
	'scripts-demo': {
		title: 'Scripts Demo',
		description: 'Inline scripts mutating state — bump score, combos, resettable fuses.',
		category: 'demo'
	},
	'collision-demo': {
		title: 'Collision Demo',
		description: 'Collision triggers and responses between bodies and pickups.',
		category: 'demo'
	},
	'player-avatar-override': {
		title: 'Avatar Override Demo',
		description: 'Per-player avatar override — swap the character mesh at runtime.',
		category: 'demo'
	}
};
