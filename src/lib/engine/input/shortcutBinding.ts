/** Keyboard shortcut matching and display helpers. */

export type ShortcutAction =
	| 'togglePlay'
	| 'toggleSidebars'
	| 'copy'
	| 'paste'
	| 'duplicate'
	| 'cut'
	| 'delete'
	| 'undo'
	| 'redo'
	| 'gizmoTranslate'
	| 'gizmoRotate'
	| 'gizmoScale'
	| 'viewportPan';

export type KeyBinding = {
	/** Primary match — `event.key` (lowercase for letters). */
	key: string;
	/** Optional `event.code` disambiguation (e.g. Backslash). */
	code?: string;
	mod?: boolean;
	shift?: boolean;
	alt?: boolean;
};

export type ShortcutBindings = Record<ShortcutAction, KeyBinding[]>;

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
	togglePlay: 'Toggle play mode',
	toggleSidebars: 'Toggle sidebars',
	copy: 'Copy selection',
	paste: 'Paste',
	duplicate: 'Duplicate selection',
	cut: 'Cut selection',
	delete: 'Delete selection',
	undo: 'Undo',
	redo: 'Redo',
	gizmoTranslate: 'Move gizmo',
	gizmoRotate: 'Rotate gizmo',
	gizmoScale: 'Scale gizmo',
	viewportPan: 'Pan viewport (hold)'
};

/** Studio defaults — Figma-style navigation companion keys. */
export const STUDIO_SHORTCUTS: ShortcutBindings = {
	togglePlay: [{ key: 'p' }],
	toggleSidebars: [{ key: '\\', code: 'Backslash', mod: true }],
	copy: [{ key: 'c', mod: true }],
	paste: [{ key: 'v', mod: true }],
	duplicate: [{ key: 'd', mod: true }],
	cut: [{ key: 'x', mod: true }],
	delete: [{ key: 'Delete' }, { key: 'Backspace' }],
	undo: [{ key: 'z', mod: true }],
	redo: [{ key: 'z', mod: true, shift: true }],
	gizmoTranslate: [{ key: 'm' }],
	gizmoRotate: [{ key: 'r' }],
	gizmoScale: [{ key: 's' }],
	viewportPan: [{ key: ' ', code: 'Space' }]
};

/** Blender-style transform keys (G/R/S) with standard clipboard modifiers. */
export const BLENDER_SHORTCUTS: ShortcutBindings = {
	togglePlay: [{ key: 'p' }],
	toggleSidebars: [{ key: '\\', code: 'Backslash', mod: true }],
	copy: [{ key: 'c', mod: true }],
	paste: [{ key: 'v', mod: true }],
	duplicate: [{ key: 'd', mod: true }],
	cut: [{ key: 'x', mod: true }],
	delete: [{ key: 'Delete' }, { key: 'Backspace' }],
	undo: [{ key: 'z', mod: true }],
	redo: [{ key: 'z', mod: true, shift: true }],
	gizmoTranslate: [{ key: 'g' }],
	gizmoRotate: [{ key: 'r' }],
	gizmoScale: [{ key: 's' }],
	viewportPan: [{ key: ' ', code: 'Space' }]
};

export function cloneBindings(source: ShortcutBindings): ShortcutBindings {
	const next = {} as ShortcutBindings;
	for (const action of Object.keys(source) as ShortcutAction[]) {
		next[action] = source[action].map((binding) => ({ ...binding }));
	}
	return next;
}

function bindingKey(event: KeyboardEvent): string {
	if (event.key === ' ') return ' ';
	return event.key.length === 1 ? event.key.toLowerCase() : event.key;
}

function modHeld(event: KeyboardEvent): boolean {
	return event.metaKey || event.ctrlKey;
}

export function eventMatchesBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
	if (Boolean(binding.mod) !== modHeld(event)) return false;
	if (Boolean(binding.shift) !== event.shiftKey) return false;
	if (Boolean(binding.alt) !== event.altKey) return false;
	if (binding.code && event.code !== binding.code) return false;
	return bindingKey(event) === binding.key;
}

export function eventMatchesAction(
	event: KeyboardEvent,
	action: ShortcutAction,
	bindings: ShortcutBindings
): boolean {
	return bindings[action].some((binding) => eventMatchesBinding(event, binding));
}

export function primaryBinding(
	action: ShortcutAction,
	bindings: ShortcutBindings
): KeyBinding | undefined {
	return bindings[action][0];
}

export function formatBinding(binding: KeyBinding | undefined): string {
	if (!binding) return '—';
	const parts: string[] = [];
	const isMac =
		typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);

	if (binding.mod) parts.push(isMac ? '⌘' : 'Ctrl');
	if (binding.shift) parts.push(isMac ? '⇧' : 'Shift');
	if (binding.alt) parts.push(isMac ? '⌥' : 'Alt');

	const keyLabel =
		binding.key === ' '
			? 'Space'
			: binding.key.length === 1
				? binding.key.toUpperCase()
				: binding.key;
	parts.push(keyLabel);
	return parts.join(isMac ? '' : '+');
}

export function bindingFromKeyboardEvent(event: KeyboardEvent): KeyBinding | null {
	if (modHeld(event) && (event.key === 'Control' || event.key === 'Meta')) return null;
	if (event.key === 'Shift' || event.key === 'Alt') return null;

	const binding: KeyBinding = { key: bindingKey(event) };
	if (event.code === 'Space') binding.code = 'Space';
	if (event.code === 'Backslash') binding.code = 'Backslash';
	if (modHeld(event)) binding.mod = true;
	if (event.shiftKey) binding.shift = true;
	if (event.altKey) binding.alt = true;
	return binding;
}
