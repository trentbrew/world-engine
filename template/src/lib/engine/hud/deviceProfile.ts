/**
 * Device HUD profile — the identity a game paints onto the (generic) edit-mode
 * "drone" HUD. The CAPABILITY (an embodied, skinnable edit vantage + HUD frame) is
 * engine-generic; the IDENTITY (name, accent, telemetry copy) is per-game data.
 *
 * This resolver is the seam. Today it maps a `?game=` param prefix to a profile;
 * eventually the profile should come from the world document itself (WorldProfile /
 * config), so identity lives fully in data — see packs/README.md. Keeping it swappable
 * here is what lets Craftpunk read "Turtle Slate" while POWDER reads "Snowcat" off the
 * same component, and is the guardrail against overfitting the HUD to one game.
 */

export type DeviceProfile = {
	/** Stable id (kebab). */
	id: string;
	/** Short device name shown in the HUD chip, e.g. "SLATE". */
	name: string;
	/** Longer label for a11y / tooltip, e.g. "Turtle Slate". */
	label: string;
	/** One-line flavor shown as faux telemetry. */
	tagline: string;
	/** Accent color (CSS color or var()) for frame + reticle. */
	accent: string;
	/** Show the centered reticle dot. */
	reticle: boolean;
};

/** Generic fallback — reads as a neutral editor drone, no game identity. */
export const DEFAULT_DEVICE_PROFILE: DeviceProfile = {
	id: 'drone',
	name: 'DRONE',
	label: 'Editor drone',
	tagline: 'build vantage',
	accent: 'var(--accent, #7c8ea3)',
	reticle: true
};

/** Per-game identities. Keyed by `?game=` param prefix (before the first `/`). */
const PROFILES: Record<string, DeviceProfile> = {
	craftpunk: {
		id: 'turtle-slate',
		name: 'SLATE',
		label: 'Turtle Slate',
		tagline: 'tending the commons',
		accent: '#6fae74',
		reticle: true
	}
	// powder: { id: 'snowcat', name: 'SNOWCAT', label: 'Course editor', tagline: 'shaping the run', accent: '#9cc4e4', reticle: true }
};

/** Resolve the device identity for a `?game=` param (e.g. "craftpunk/commons"). */
export function resolveDeviceProfile(gameParam?: string): DeviceProfile {
	if (!gameParam) return DEFAULT_DEVICE_PROFILE;
	const prefix = gameParam.split('/')[0];
	return PROFILES[prefix] ?? DEFAULT_DEVICE_PROFILE;
}
