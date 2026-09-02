/**
 * Silicon City — generate a walkable 3D city from THIS machine's live IORegistry.
 *
 * Districts are subsystems, buildings are devices, height is how much of the
 * system hangs beneath a node. Every number comes from ioreg / system_profiler
 * at generation time — nothing here is hand-placed.
 *
 *   node scripts/silicon-city.mjs [--max 520] [--out static/games/silicon-city.jsonld]
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// ---- args ------------------------------------------------------------------

function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`);
	return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const MAX_BUILDINGS = Number(arg('max', 520));
const OUT = path.resolve(root, '..', arg('out', 'static/games/silicon-city.jsonld'));

/**
 * The first city was laid out at CITY=104 with a 0.42 street pad. A player is
 * ~1.8 units tall, so that produced 1–3 unit pencil towers in half-unit alleys —
 * a maze, not a city. Every gap below is absolute and does NOT scale with CITY,
 * so widening the plot alone would only make the alleys relatively narrower.
 * SCALE grows the plots; the pads are retuned by hand against a walking player.
 */
const SCALE = Number(arg('scale', 1.92));
const CITY = Math.round(104 * SCALE); // ground plane extent (world units ≈ meters)

/** Street widths, in units, measured against a ~1.8-unit-tall player. */
const STREET = 1.5; // between buildings inside a block
const AVENUE = 2.6; // between district slabs
const BOULEVARD = 3.0; // depth-0 district border

// ---- probe the machine -----------------------------------------------------

function sh(cmd, args, timeout = 45000) {
	try {
		return execFileSync(cmd, args, {
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024,
			timeout,
			stdio: ['ignore', 'pipe', 'ignore']
		});
	} catch {
		return '';
	}
}

/** One system_profiler invocation for every datatype we need — four is slow. */
function profileAll() {
	const raw = sh('system_profiler', [
		'-json',
		'SPHardwareDataType',
		'SPPowerDataType',
		'SPNVMeDataType',
		'SPDisplaysDataType'
	]);
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

/** Parse `ioreg -w0` into a tree. Depth is leading indent / 2. */
function readRegistry() {
	const text = sh('ioreg', ['-w0']);
	const rootNode = { name: 'Root', cls: 'IORegistryEntry', depth: -1, children: [], retain: 0 };
	const stack = [rootNode];

	for (const line of text.split('\n')) {
		const at = line.indexOf('+-o ');
		if (at < 0) continue;
		const depth = Math.floor(at / 2);
		const rest = line.slice(at + 4);
		const split = rest.indexOf('  <class ');
		if (split < 0) continue;
		const name = rest.slice(0, split).trim();
		const meta = rest.slice(split + 9);
		const comma = meta.indexOf(',');
		const cls = (comma < 0 ? meta : meta.slice(0, comma)).trim();
		const retain = Number(/retain (\d+)/.exec(meta)?.[1] ?? 0);
		if (name === 'Root' && depth === 0) continue;

		const node = { name, cls, depth, retain, children: [] };
		while (stack.length > depth) stack.pop();
		(stack[stack.length - 1] ?? rootNode).children.push(node);
		stack.push(node);
	}
	return rootNode;
}

function countSubtree(node) {
	node.size = 1 + node.children.reduce((n, c) => n + countSubtree(c), 0);
	return node.size;
}

// ---- palette ---------------------------------------------------------------

/**
 * Ordered most-specific-first; first match wins. All case-insensitive — device
 * tree names are lowercase (`smc`, `arm-io`, `cpu0`) while classes are CamelCase,
 * and matching only the latter left 70% of the city generic grey.
 *
 * Patterns are drawn from what this machine actually reports, not from guesses:
 * `ioreg -w0 | grep -o '+-o [^ ]*' | sort | uniq -c | sort -rn`.
 */
const FAMILIES = [
	// Before power: AppleARMPMUTempSensor is thermal, AppleARMPMUPowerSensor is not.
	[/temp|thermal|\bfan\b/i, '#00e5ff', 'thermal'],
	[/^cpu\d|cluster|pmgr|armperf|corecrypto/i, '#ffa23a', 'compute'],
	[/agx|iosurface|\bgpu\b|display|backlight|framebuffer|hdcp|iodp|mobilefb/i, '#2f9cff', 'graphics'],
	[/\bane\b|neural|h1xane/i, '#7b5cff', 'neural'],
	[/nvme|\bans\d|storage|disk|apfs|media|partition|blockstorage|bsdclient/i, '#00ffc8', 'storage'],
	[/usb|thunderbolt|typec|xhci|pcie?|apciec|bridge|dart|hub|port[-_]/i, '#ff6b3d', 'bus'],
	[/audio|speaker|\bmic\b|\baop\b|\bspu\b|codec/i, '#ff5ea8', 'audio'],
	[/battery|power|\bsmc\b|\bpmu|charger|brick|rootdomain/i, '#ffd23a', 'power'],
	[/\bhid\b|keyboard|trackpad|multitouch|button|actuator/i, '#5ce1ff', 'input'],
	[
		/bluetooth|wireless|wifi|80211|broadcom|\bbcm|ethernet|network|cclog|ccpipe|corecapture/i,
		'#37ffa8',
		'radio'
	],
	[/nvram|options|iboot|\bboot|firmware|\bsep\b|keystore|credential|\bfde\b|fairplay|keybag/i, '#ff2fd0', 'secure'],
	[/camera|\bisp\b|\bave\b|video|jpeg|venc/i, '#ff8a5c', 'media'],
	[/rtbuddy|ascwrap|afkep|endpoint|\biop\b/i, '#a06bff', 'coprocessor']
];

// Dim slate, not mid-grey: unclassified nodes are the majority, and at the old
// #6b6f7a they dominated every frame. Down here they read as the dark mass the
// neon is set against.
const GENERIC = { color: '#1b2a33', label: 'system' };

function familyOf(node) {
	const hay = `${node.name} ${node.cls}`;
	for (const [re, color, label] of FAMILIES) if (re.test(hay)) return { color, label };
	return GENERIC;
}

/**
 * Nodes that earn a plot on identity rather than subtree size: the ten CPU
 * cores, the physical ports, and the named silicon blocks. All are size-1
 * leaves, so weight-ranking alone would merge them into the long tail.
 */
const LANDMARK = /^cpu\d+@|^port-|^arm-io$|^cpus$|nvme|^ans\b|agx|\bane\b|sep\b|smc|battery|trackpad|bluetooth|speaker|backlight/i;

function isLandmark(node) {
	return LANDMARK.test(`${node.name} ${node.cls}`);
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** Mix a hex colour toward near-black — district slabs read as tinted ground. */
function darken(hex, keep) {
	const n = parseInt(hex.slice(1), 16);
	const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
		Math.round(v * keep + 0x12 * (1 - keep))
	);
	return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---- squarified treemap ----------------------------------------------------

/** Lay `items` ({ weight }) into rect { x, z, w, d }; assigns .rect on each. */
function squarify(items, rect) {
	const total = items.reduce((n, i) => n + i.weight, 0) || 1;
	let { x, z, w, d } = rect;
	const queue = [...items].sort((a, b) => b.weight - a.weight);
	let remaining = total;

	while (queue.length && w > 0.01 && d > 0.01) {
		const horizontal = w >= d;
		const span = horizontal ? d : w;
		const row = [];
		let rowWeight = 0;
		let best = Infinity;

		while (queue.length) {
			const next = queue[0];
			const tryWeight = rowWeight + next.weight;
			const area = (tryWeight / remaining) * (w * d);
			const thickness = area / span || 1e-6;
			const worst = Math.max(
				...[...row, next].map((it) => {
					const side = ((it.weight / tryWeight) * area) / thickness || 1e-6;
					return Math.max(side / thickness, thickness / side);
				})
			);
			if (row.length && worst > best) break;
			best = worst;
			rowWeight = tryWeight;
			row.push(queue.shift());
		}

		const area = (rowWeight / remaining) * (w * d);
		const thickness = Math.min(area / span || 1e-6, horizontal ? w : d);
		let cursor = horizontal ? z : x;
		for (const it of row) {
			const side = ((it.weight / rowWeight) * area) / thickness || 1e-6;
			it.rect = horizontal
				? { x, z: cursor, w: thickness, d: side }
				: { x: cursor, z, w: side, d: thickness };
			cursor += side;
		}

		if (horizontal) {
			x += thickness;
			w -= thickness;
		} else {
			z += thickness;
			d -= thickness;
		}
		remaining -= rowWeight;
	}
	return items;
}

// ---- machine facts ---------------------------------------------------------

const registry = readRegistry();
countSubtree(registry);

const sp = profileAll();
const hw = sp.SPHardwareDataType?.[0] ?? {};
const power = sp.SPPowerDataType ?? [];
const nvme = sp.SPNVMeDataType ?? [];
const gpu = sp.SPDisplaysDataType?.[0] ?? {};

const battery = power.find((p) => p._name === 'spbattery_information') ?? {};
const health = battery.sppower_battery_health_info ?? {};
const nvmeCtrl = nvme[0]?._items?.[0] ?? nvme[0] ?? {};

const graph = [];
const plaques = [];
let buildingCount = 0;

const num = (v, f = 0) => (Number.isFinite(v) ? Number(v.toFixed(3)) : f);

function push(id, type, components) {
	graph.push({ '@id': id, '@type': 'Thing', conformsTo: type, components });
}

function slug(s) {
	return (
		String(s)
			.replace(/[^A-Za-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.toLowerCase() || 'node'
	);
}

/** A district floor slab, walkable, labelled by plaque. */
function emitDistrict(node, rect, index) {
	const pad = AVENUE;
	const w = Math.max(rect.w - pad, 0.6);
	const d = Math.max(rect.d - pad, 0.6);
	const cx = rect.x + rect.w / 2 - CITY / 2;
	const cz = rect.z + rect.d / 2 - CITY / 2;
	const fam = familyOf(node);

	// Deeper districts sit fractionally higher and tint harder, so nested plots
	// read as neighbourhoods instead of one flat black field.
	const components = {
		Render: {
			mesh: 'primitive:box',
			color: darken(fam.color, 0.1 + Math.min(index, 4) * 0.045),
			// A floor should never out-glow the towers standing on it — this is a
			// faint wash that tells you which neighbourhood you're in from above,
			// well under the bloom threshold.
			emissive: fam.color,
			emissiveIntensity: 0.1,
			anchor: 'bottom'
		},
		Transform: {
			position: [num(cx), num(0.02 + index * 0.03), num(cz)],
			rotation: [0, 0, 0, 1],
			scale: [num(w), 0.16, num(d)]
		}
	};
	// Only substantial districts announce themselves — every slab would spam.
	if (node.size >= 40) {
		components.Plaque = {
			title: node.name,
			artist: `${fam.label} district · ${node.cls}`,
			year: `${node.size} nodes`,
			radius: Math.max(3, Math.min(w, d) * 0.35)
		};
	}
	push(`entity:district/${slug(node.name)}-${index}-${graph.length}`, 'District', components);
}

/**
 * Glowing kerbs along a district's border. The engine's ground grid is edit-mode
 * only (GroundView.svelte gates it on shellMode), so the Tron floor has to be
 * real geometry — which is the better answer anyway: these strips trace the
 * treemap, so the street plan *is* the IORegistry hierarchy rather than an
 * arbitrary lattice. Only the top three levels get them; below that the borders
 * are closer together than the streets are wide and it turns to mush.
 */
function emitRoads(rect, depth, fam) {
	if (depth > 2) return;
	const t = 0.34; // kerb width
	const glow = [2.6, 1.7, 1.05][depth];
	const cx = rect.x + rect.w / 2 - CITY / 2;
	const cz = rect.z + rect.d / 2 - CITY / 2;
	const hw = rect.w / 2;
	const hd = rect.d / 2;
	// Four kerbs; the long pair overlaps the short pair at the corners, which is
	// what closes the loop cleanly under bloom.
	const strips = [
		[cx, cz - hd, rect.w, t],
		[cx, cz + hd, rect.w, t],
		[cx - hw, cz, t, rect.d],
		[cx + hw, cz, t, rect.d]
	];
	for (const [x, z, sw, sd] of strips) {
		push(`entity:road/${depth}-${graph.length}`, 'Device', {
			Render: {
				mesh: 'primitive:box',
				color: fam.color,
				emissive: fam.color,
				emissiveIntensity: glow,
				anchor: 'bottom'
			},
			Transform: {
				position: [num(x), num(0.03 + depth * 0.01), num(z)],
				rotation: [0, 0, 0, 1],
				scale: [num(sw), 0.06, num(sd)]
			}
		});
	}
}

/** One building. Height encodes the subtree hanging beneath this node. */
function emitBuilding(node, rect, keyFacts) {
	if (buildingCount >= MAX_BUILDINGS) return;
	buildingCount++;

	const pad = STREET;
	// Only the small, collapsed landmarks get tower treatment — see layout().
	const mark = isLandmark(node) && node.size <= 8;
	// The landmark weight floor buys a generous plot, but spending all of it on
	// footprint yields a squat plateau you stand on top of. Cap the footprint and
	// put the emphasis into height instead, so a core reads as a tower.
	//
	// The global cap matters just as much: an aggregate node ("N more") can win a
	// plot tens of units across, and spending all of it produces a single slab the
	// size of a neighbourhood. Past the cap the surplus becomes plaza, which is
	// what gives the dense blocks somewhere to breathe. The floor is the mirror
	// image — without it a thin plot yields a 0.34-wide needle.
	const cap = mark ? 3.4 * SCALE : 9.5;
	// The street is a share of the plot, not a fixed subtraction. A flat 1.5 is
	// right for a 10-unit plot and catastrophic for a 2-unit one, where it eats
	// the building entirely and leaves the minimum-width needle behind.
	const w = clamp(rect.w - Math.min(pad, rect.w * 0.3), 1.1, cap);
	const d = clamp(rect.d - Math.min(pad, rect.d * 0.3), 1.1, cap);
	const cx = rect.x + rect.w / 2 - CITY / 2;
	const cz = rect.z + rect.d / 2 - CITY / 2;
	const fam = familyOf(node);

	// Two real signals, because subtree size alone makes a flat city: almost every
	// leaf has size 1 and lands on an identical height. Retain count — how many
	// kernel references an object is holding — varies 4..220+ across leaves, so it
	// carries the skyline where the tree has nothing left to say.
	// Footprints roughly doubled, so heights must rise too or every tower reads as
	// a squat block on an oversized plot.
	const base =
		(0.8 + Math.log2(1 + node.size) * 1.45 + Math.log2(1 + Math.min(node.retain, 400)) * 0.62) *
		1.5;
	const h = mark ? base * 2.3 : base;

	// Dark mass, glowing skin: the body is near-black tinted toward the family so
	// the silhouette reads as architecture, and the emissive term is what actually
	// clears the bloom threshold. Taller and plaque-worthy buildings burn hotter,
	// which gives the skyline a second, independent read at night.
	const heat = Math.min(h / 14, 1);
	const intensity = (mark ? 1.5 : keyFacts ? 1.15 : 0.62) + heat * 0.85;

	const id = `entity:device/${slug(node.name)}-${node.depth}-${buildingCount}`;
	const components = {
		Render: {
			mesh: 'primitive:box',
			color: darken(fam.color, 0.14),
			emissive: fam.color,
			emissiveIntensity: num(intensity),
			anchor: 'bottom'
		},
		Transform: {
			position: [num(cx), 0.18, num(cz)],
			rotation: [0, 0, 0, 1],
			scale: [num(w), num(h), num(d)]
		}
	};
	if (keyFacts) {
		components.Plaque = {
			title: node.name,
			artist: keyFacts.artist ?? node.cls,
			year: keyFacts.year ?? `${node.size} nodes · depth ${node.depth}`,
			radius: 2.6
		};
		plaques.push(id);
	}
	push(id, 'Device', components);

	// A light-line crown on the notables only. This is the single cheapest thing
	// that reads as Tron rather than as "a bright box": a hard, thin, over-driven
	// strip sitting proud of a dark roof. Restricted to named buildings so it
	// marks what's worth walking to instead of becoming wallpaper.
	if (keyFacts || mark) {
		push(`${id}/crown`, 'Device', {
			Render: {
				mesh: 'primitive:box',
				color: fam.color,
				emissive: fam.color,
				emissiveIntensity: 3.2,
				anchor: 'bottom'
			},
			Transform: {
				position: [num(cx), num(0.18 + h), num(cz)],
				rotation: [0, 0, 0, 1],
				scale: [num(w * 1.04), 0.12, num(d * 1.04)]
			}
		});
	}
}

/**
 * Recursively lay out a subtree. Nodes deeper than `maxDepth`, or whose plot got
 * too small to subdivide, collapse into one building.
 */
function layout(node, rect, depth, maxDepth, notable) {
	const area = rect.w * rect.d;
	// A *small* landmark is always a building, never a district: `cpu0@0` carries
	// one AppleARMCPU child, which would otherwise turn each core into a flat slab
	// with a shed on it — and drop the plaque that names it P or E. Big landmarks
	// like `arm-io` (~1000 nodes) must stay districts, or collapsing them throws
	// away most of the city.
	const smallLandmark = isLandmark(node) && node.size <= 8;
	// Threshold scales with the plot area (SCALE²) and then some: the point of the
	// rescale is *fewer, chunkier* buildings, not the same 291 slivers made bigger.
	if (smallLandmark || !node.children.length || depth >= maxDepth || area < 44) {
		emitBuilding(node, rect, notable(node));
		return;
	}

	emitDistrict(node, rect, depth);
	emitRoads(rect, depth, familyOf(node));

	const inset = depth === 0 ? BOULEVARD : AVENUE * 0.62;
	const inner = {
		x: rect.x + inset,
		z: rect.z + inset,
		w: Math.max(rect.w - inset * 2, 1),
		d: Math.max(rect.d - inset * 2, 1)
	};

	// Merge the long tail of tiny siblings so geometry is spent on substance —
	// but landmarks survive on identity, not weight. The ten CPU cores and the
	// physical ports are size-1 leaves; ranked purely by subtree they'd all be
	// swallowed into "N more", which loses the most walkable part of the city.
	// Landmarks also get a weight floor, or a size-1 core next to a 500-node
	// district squarifies down to an invisible sliver.
	// Area is allocated on sqrt(size), not size. Raw subtree size spans 1..2500 on
	// this machine, so a linear split hands one subtree the whole plot and leaves
	// every named device a sliver that clamps to the minimum footprint — which is
	// exactly the "narrow alleys" problem. sqrt compresses that to 1..50 and the
	// blocks come out city-sized. Size is still legible: it drives *height*, which
	// is the axis you actually read while walking.
	const kids = node.children.map((c) => ({
		node: c,
		weight: isLandmark(c) ? Math.max(Math.sqrt(c.size), 3.2) : Math.sqrt(Math.max(c.size, 1))
	}));
	const landmarks = kids.filter((k) => isLandmark(k.node));
	const rest = kids.filter((k) => !isLandmark(k.node)).sort((a, b) => b.weight - a.weight);

	const budget = Math.max(20 - landmarks.length, 7);
	const keep = [...landmarks, ...rest.slice(0, budget)];
	const tail = rest.slice(budget);
	if (tail.length) {
		// Two different sums, deliberately: `weight` is in the compressed sqrt space
		// the partition works in, while `size` must stay a real node count or the
		// aggregate's height would be meaningless.
		const tailWeight = tail.reduce((n, k) => n + k.weight, 0);
		const tailSize = tail.reduce((n, k) => n + k.node.size, 0);
		keep.push({
			node: {
				name: `${node.name} · ${tail.length} more`,
				cls: node.cls,
				depth: node.depth + 1,
				retain: 0,
				children: [],
				size: tailSize
			},
			weight: tailWeight
		});
	}

	squarify(keep, inner);
	for (const kid of keep) {
		if (kid.rect) layout(kid.node, kid.rect, depth + 1, maxDepth, notable);
	}
}

// ---- notable devices get plaques (toast spam otherwise) --------------------

function notable(node) {
	const n = node.name;

	const core = /^cpu(\d+)@/.exec(n);
	if (core) {
		const idx = Number(core[1]);
		// hw.perflevel1 = 2 E-cores, listed first in the device tree.
		const kind = idx < 2 ? 'Efficiency core (E)' : 'Performance core (P)';
		return { artist: `${hw.chip_type ?? 'SoC'} · ${kind}`, year: `core ${idx} of 10` };
	}
	if (/^port-usb-c/.test(n)) return { artist: 'Thunderbolt 4 / USB-C port', year: 'external bus' };
	if (/^port-hdmi/.test(n)) return { artist: 'HDMI port', year: 'display out' };
	if (/^port-magsafe/.test(n))
		return { artist: 'MagSafe 3', year: `${hw.ac_charger_watts ?? '140'}W input` };
	if (/^arm-io$/.test(n)) return { artist: 'On-die I/O fabric', year: `${node.size} nodes` };
	if (/NVMe|ANS2/.test(n))
		return {
			artist: nvmeCtrl.spnvme_model ?? 'Apple NVMe controller',
			year: nvmeCtrl.spnvme_capacity ?? 'internal SSD'
		};
	if (/AGX|IOGPU/.test(n))
		return {
			artist: gpu.spdisplays_device_name ?? 'Apple GPU',
			year: `${gpu.spdisplays_ncores ?? '?'} GPU cores`
		};
	if (/ANE|Neural/.test(n)) return { artist: 'Apple Neural Engine', year: '16 cores' };
	if (/Battery|AppleSmartBattery/.test(n))
		return {
			artist: `Battery · ${health.sppower_battery_health ?? 'Normal'}`,
			year: `${battery.sppower_battery_cycle_count ?? '?'} cycles · ${health.sppower_battery_health_maximum_capacity ?? '?'} capacity`
		};
	if (/Backlight/.test(n)) return { artist: 'Liquid Retina XDR backlight', year: 'display' };
	if (/Trackpad|Multitouch/.test(n)) return { artist: 'Force Touch trackpad', year: 'HID' };
	if (/Bluetooth/.test(n)) return { artist: 'Bluetooth controller', year: 'radio' };
	if (/SEP|AppleSEP/.test(n)) return { artist: 'Secure Enclave', year: 'isolated' };
	if (/Speaker/.test(n)) return { artist: 'Six-speaker sound system', year: 'audio' };
	if (node.size > 90) return { artist: node.cls, year: `${node.size} nodes beneath` };
	return null;
}

// ---- scene scaffolding -----------------------------------------------------

const chip = hw.chip_type ?? 'Apple Silicon';
const model = hw.machine_model ?? 'Mac';
const mem = hw.physical_memory ?? '';

graph.push(
	// NB: no `component:Plaque` schema here on purpose. plaqueProximity.ts already
	// registers Plaque with `sync: 'durable'` on every field; redeclaring it drops
	// those flags and the authored title/artist never reach the entity bag —
	// every plaque then reads "Untitled — Unknown".
	{
		'@id': 'type:District',
		'@type': 'EntityType',
		components: ['Transform', 'Render', 'Plaque'],
		defaults: { Render: { mesh: 'primitive:box', color: '#16171d' } }
	},
	{
		'@id': 'type:Device',
		'@type': 'EntityType',
		components: ['Transform', 'Render', 'Plaque'],
		defaults: { Render: { mesh: 'primitive:box', color: '#6b6f7a' } }
	},
	{
		'@id': 'entity:scene/meta',
		'@type': 'Thing',
		conformsTo: 'Prop',
		components: {
			EditorScene: { document: { scene: { displayName: 'Silicon City' } } },
			Render: { visible: false },
			Transform: { position: [0, -40, 0], rotation: [0, 0, 0, 1], scale: [0.01, 0.01, 0.01] }
		}
	},
	// The scene document is read from THIS id and nowhere else (sceneSettings.init
	// → world.getEntity(SCENE_SETTINGS_ENTITY_ID)), and parseSceneDocument returns
	// defaults outright unless `v` matches SCENE_DOCUMENT_VERSION. The copy on
	// entity:scene/meta above is dead weight for rendering — it survives only
	// because gamesCatalogPlugin scrapes the raw JSON for the catalog title. Both
	// facts have to hold or the whole look silently reverts to the grey default.
	{
		'@id': 'entity:scene/settings',
		'@type': 'Thing',
		conformsTo: 'Prop',
		components: {
			EditorScene: {
				document: {
					v: 1,
					scene: {
						displayName: 'Silicon City',
						background: '#04060a',
						// 400+ shadow casters for a look where nothing is lit by the sun
						// anyway — the glow does the work.
						shadows: false,
						sky: { enabled: false },
						style: {
							artStyle: 'custom',
							materialMode: 'standard',
							toneMapping: 'agx',
							exposure: 1.1,
							// Threshold is the whole ballgame: the composer renders to a
							// half-float buffer and tone-maps after bloom, so emissive
							// above ~0.3 luminance blooms. Raise this and the neon dies.
							bloom: { enabled: true, intensity: 1.15, threshold: 0.28 },
							// Fog at exactly the background colour is what turns a treemap
							// into a place — the far towers dissolve instead of ending.
							fog: { enabled: true, color: '#04060a', near: 30, far: 210 },
							vignette: { enabled: true, darkness: 0.6 },
							grain: { enabled: true, opacity: 0.08 },
							outline: { enabled: false, color: '#04060a', thickness: 2 },
							sketch: { enabled: false, intensity: 0.6 }
						}
					}
				}
			},
			Render: { visible: false },
			Transform: { position: [0, -40, 0], rotation: [0, 0, 0, 1], scale: [0.01, 0.01, 0.01] }
		}
	},
	{
		'@id': 'entity:ground/main',
		'@type': 'Thing',
		conformsTo: 'GroundPlane',
		components: {
			// The trailing alpha byte is load-bearing: opacity < 0.999 flips GroundView
			// to an unlit MeshBasicMaterial, giving a true flat black floor that the
			// sun can't wash into grey. fe = 0.996, so nothing shows through.
			Ground: { size: CITY + 30, color: '#05060afe' },
			Transform: { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
		}
	},
	{
		'@id': 'entity:light/ambient',
		'@type': 'Thing',
		conformsTo: 'AmbientLight',
		// Low: the buildings are self-lit now, and ambient fill is what flattens a
		// neon scene into pastel. (Light.color is declared in the schema but
		// LightView never reads it — every light is white regardless.)
		components: { Light: { intensity: 0.16 } }
	},
	{
		'@id': 'entity:light/sun',
		'@type': 'Thing',
		conformsTo: 'DirectionalLight',
		components: {
			// A rim, not a sun: just enough directional to keep the dark faces from
			// going fully black so the boxes still read as solids.
			Light: { intensity: 0.34 },
			Transform: { position: [34, 46, 22], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
		}
	},
	{
		'@id': 'entity:spawn/gate',
		'@type': 'Thing',
		conformsTo: 'SpawnPoint',
		components: {
			// Just outside the treemap footprint (the city fills ±CITY/2 edge to
			// edge), so you approach it across open ground instead of spawning on
			// a rooftop.
			Transform: { position: [0, 0.05, CITY / 2 + 6], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
		}
	}
);

// The platform-expert node is the real city; Root is just a wrapper.
const platform = registry.children.find((c) => c.children.length > 4) ?? registry;
layout(platform, { x: 0, z: 0, w: CITY, d: CITY }, 0, 5, notable);

const doc = {
	'@context': {
		'@vocab': 'https://game.example/vocab/',
		conformsTo: { '@type': '@id' },
		components: { '@type': '@json' }
	},
	comment: `Walk the machine you're running on. Every building is a live IORegistry node on this ${model} (${chip}, ${mem}) — height is how much of the system hangs beneath it, colour is the subsystem. Generated from ioreg, not authored.`,
	'@graph': graph
};

writeFileSync(OUT, `${JSON.stringify(doc, null, '\t')}\n`);

const districts = graph.filter((g) => g.conformsTo === 'District').length;
console.log(`Silicon City -> ${path.relative(process.cwd(), OUT)}`);
console.log(`  machine    ${model} · ${chip} · ${mem}`);
console.log(`  registry   ${registry.size - 1} live IORegistry nodes`);
console.log(
	`  city       ${districts} districts · ${buildingCount} buildings · ${plaques.length} plaques`
);
