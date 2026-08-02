/** Brief hover descriptions for scene + entity inspector fields. */
const INSPECTOR_FIELD_HELP: Record<string, string> = {
	// Essentials
	'scene-name': 'Display name for this world in the editor and save file.',
	'scene-background': 'Clear color behind the scene when no sky is active.',

	// Environment
	'scene-sky-preset':
		'HDR sky preset. None disables the skydome; presets set sun angle and ambient color.',
	'scene-sky-env': 'Use the sky as image-based lighting for PBR materials.',
	'scene-shadows': 'Enable real-time shadow maps for lit meshes.',

	// Camera
	'cam-projection': 'Lens model — perspective for depth or orthographic for parallel lines.',
	'cam-nudge-space':
		'Arrow-key nudge: 3D uses X/Z (Alt+↑↓ for Y); 2D side-view uses X/Y.',
	'cam-fov': 'Vertical field of view in degrees (perspective only).',
	'cam-near': 'Nearest distance drawn. Increase if close geometry clips.',
	'cam-far': 'Farthest distance drawn. Lower to improve depth precision.',
	'cam-rotate': 'Orbit speed when rotating around the target.',
	'cam-dolly': 'Zoom speed when moving toward or away from the target.',
	'cam-truck': 'Pan speed when sliding the camera on its focal plane.',
	'cam-smooth': 'Control smoothing — higher values feel heavier and lag more.',
	'cam-min-dist': 'Closest the orbit camera can dolly to the target.',
	'cam-max-dist': 'Farthest the orbit camera can dolly from the target.',
	'cam-min-polar': 'Lowest vertical orbit angle in degrees above the horizon.',
	'cam-max-polar': 'Highest vertical orbit angle in degrees above the horizon.',
	'cam-dolly-cursor': 'Zoom toward the pointer instead of the orbit center.',
	'cam-infinity': 'Allow dollying past the max distance limit.',
	'cam-invert-y': 'Flip vertical orbit direction.',

	// Shaders / look
	'style-material': 'Default surface shading mode for rendered meshes.',
	'style-tonemap': 'HDR tone-mapping curve applied before display.',
	'style-exposure': 'Global brightness multiplier before tone mapping.',
	'style-fog': 'Distance fog. None disables atmospheric fade.',
	'style-fog-color': 'Fog color blended over distant geometry.',
	'style-fog-near': 'Distance where fog begins.',
	'style-fog-far': 'Distance where fog reaches full strength.',
	'style-bloom': 'Post-process glow on bright pixels. None disables.',
	'style-bloom-intensity': 'Bloom strength — how much bright areas spread.',
	'style-bloom-threshold': 'Brightness level that starts contributing to bloom.',
	'style-vignette': 'Darken the screen edges. None disables.',
	'style-vignette-darkness': 'How strong the edge darkening is.',
	'style-grain': 'Film grain overlay. None disables.',
	'style-grain-opacity': 'Grain visibility.',
	'style-outline': 'Screen-space outline pass. None disables.',
	'style-outline-color': 'Color of the outline stroke.',
	'style-outline-thickness': 'Outline width in pixels.',
	'style-sketch': 'Hand-drawn hatch shading. None disables.',
	'style-sketch-intensity': 'Sketch effect strength.',

	// Grids
	'ref-grid-show': 'Editor reference grid overlaid in the viewport.',
	'ref-grid-infinite': 'Extend the reference grid toward the horizon.',
	'ref-grid-cell': 'Spacing between minor reference grid lines.',
	'ref-grid-section': 'Spacing between major reference grid lines.',
	'ref-grid-fade': 'Distance at which the reference grid fades out.',
	'ref-grid-cell-color': 'Color of minor reference grid lines.',
	'ref-grid-section-color': 'Color of major reference grid lines.',
	'ground-grid-show': 'Grid drawn on Ground plane entities in the world.',
	'ground-grid-cell': 'Minor line spacing on ground planes.',
	'ground-grid-section': 'Major line spacing on ground planes.',
	'ground-grid-cell-color': 'Minor line color on ground planes.',
	'ground-grid-section-color': 'Major line color on ground planes.',

	// Selection / developer
	'scene-selection-outline': 'Highlight outline on the selected entity.',
	'scene-stats-hud': 'FPS and draw-call overlay during play mode (top-right).',

	// Component fields (right panel)
	'Transform.position': 'World position as X, Y, Z. Synced in realtime for owned entities.',
	'Transform.rotation': 'Euler angles in degrees (x, y, z). Stored as a quaternion internally. Synced in realtime for owned entities.',
	'Transform.scale': 'Non-uniform scale along each axis.',
	'Render.mesh': 'Primitive id (primitive:box) or URL to a .glb / .gltf asset.',
	'Render.color': 'Base tint applied to the mesh material.',
	'Render.anchor': 'How the mesh pivot aligns to position — origin, feet (bottom), or center.',
	'Light.kind': 'Ambient fills the scene; directional casts parallel rays from Transform.',
	'Light.intensity': 'Brightness multiplier for this light.',
	'Marker.kind': 'Marker role — spawn points place new players near this entity.',
	'Ground.size': 'Width and depth of the ground plane in world units.',
	'Ground.color': 'Fill color of the ground plane and its grid.',
	'Player.speed': 'Locomotion scale — 4 is baseline; tiers come from stick deflection (Ctrl walk, Alt run, Shift sprint).',
	'Player.color': 'Avatar tint — each client gets a distinct default from its id.',
	'Player.slope':
		'Climb limit in degrees — full speed below the low angle; movement fades out up to the high angle.',
	'Player.groundAcc': 'Ground acceleration — how quickly horizontal speed builds on the floor.',
	'Player.airAcc': 'Air acceleration — horizontal control while airborne.',
	'Player.airDrag': 'Air resistance — higher values slow horizontal drift in the air.',
	'Player.velocityClipThreshold':
		'Ignore tiny horizontal velocities below this speed (reduces jitter).',
	'Player.visualsOffsetThreshold':
		'Start smoothing the visual mesh when physics offset exceeds this distance.',
	'Player.visualsLerpFactor': 'How fast the visual mesh catches up to the physics body.',
	'Player.maxVisualsOffset': 'Cap on visual-physics separation during normal movement.',
	'Player.maxStepVisual': 'Max visual offset allowed when stepping up ledges.',
	'Gravity.g': 'Gravitational acceleration downward in units per second².',
	'Gravity.vy': 'Current vertical velocity. Integrated each tick by the gravity system.',
	'Gravity.rest': 'Y height where the entity rests on the ground.',
	'Physics.body':
		'Rigid-body type — fixed (static), dynamic (simulated), or kinematic (moved by script).',
	'Physics.collider':
		'Collision shape — box, ball, capsule, or mesh-derived hull/trimesh for glTF.',
	'Physics.mass': 'Mass in kilograms (affects inertia and contact response).',
	'Physics.restitution': 'Bounciness — 0 absorbs impact, 1 perfectly elastic.',
	'Physics.friction': 'Surface friction against other colliders.',
	'Physics.gravityScale': 'Multiplier on world gravity for this body (0 = float).'
};

export function getInspectorFieldHelp(key: string): string | undefined {
	return INSPECTOR_FIELD_HELP[key];
}

export function resolveInspectorFieldHelp(options: {
	id?: string;
	component?: string;
	field?: string;
	description?: string;
}): string | undefined {
	if (options.description) return options.description;
	if (options.id) {
		const byId = INSPECTOR_FIELD_HELP[options.id];
		if (byId) return byId;
	}
	if (options.component && options.field) {
		return INSPECTOR_FIELD_HELP[`${options.component}.${options.field}`];
	}
	return undefined;
}

