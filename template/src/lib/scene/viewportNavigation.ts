import CameraControls from 'camera-controls';
import type { NavigationScheme } from '$lib/engine/input/inputPrefs.svelte';
import { inputPrefs } from '$lib/engine/input/inputPrefs.svelte';
import { eventMatchesAction } from '$lib/engine/input/shortcutBinding';
import { isFormFieldFocused } from '$lib/ui/shellKeyboard';

export type ViewportNavigationOptions = {
	controls: CameraControls;
	dom: HTMLElement;
	isOrtho: boolean;
	scheme?: NavigationScheme;
	enabled?: () => boolean;
};

type WheelAction = (typeof CameraControls.prototype.mouseButtons)['wheel'];
type MarkedWheelEvent = WheelEvent & { __viewportNavSynthetic?: true };

/** Pinch (ctrlKey) or Cmd+scroll (metaKey) on trackpad — zoom, not pan/orbit. */
function isZoomWheel(event: WheelEvent): boolean {
	return event.ctrlKey || event.metaKey;
}

/** Physical mouse wheel — not a trackpad pan/orbit gesture. */
function isMouseWheel(event: WheelEvent): boolean {
	return event.deltaMode === WheelEvent.DOM_DELTA_LINE;
}

function isTrackpadGesture(event: WheelEvent): boolean {
	return !isZoomWheel(event) && !isMouseWheel(event);
}

function zoomWheelAction(isOrtho: boolean): WheelAction {
	return isOrtho ? CameraControls.ACTION.ZOOM : CameraControls.ACTION.DOLLY;
}

function bindWheelRouting({
	controls,
	dom,
	isOrtho,
	enabled = () => true,
	resolveAction
}: {
	controls: CameraControls;
	dom: HTMLElement;
	isOrtho: boolean;
	enabled?: () => boolean;
	resolveAction: (event: WheelEvent, zoom: WheelAction) => WheelAction;
}): () => void {
	const savedWheel = controls.mouseButtons.wheel;
	controls.mouseButtons.wheel = CameraControls.ACTION.NONE;

	const zoom = zoomWheelAction(isOrtho);

	const dispatchWheel = (source: WheelEvent, action: WheelAction) => {
		const prev = controls.mouseButtons.wheel;
		controls.mouseButtons.wheel = action;
		const synthetic = new WheelEvent('wheel', {
			deltaX: source.deltaX,
			deltaY: source.deltaY,
			deltaZ: source.deltaZ,
			deltaMode: source.deltaMode,
			clientX: source.clientX,
			clientY: source.clientY,
			shiftKey: source.shiftKey,
			// Never forward ctrlKey — library would switch pinch to ZOOM on perspective.
			ctrlKey: false,
			bubbles: true,
			cancelable: true
		}) as MarkedWheelEvent;
		synthetic.__viewportNavSynthetic = true;
		dom.dispatchEvent(synthetic);
		controls.mouseButtons.wheel = prev;
	};

	const onWheelCapture = (event: WheelEvent) => {
		if ((event as MarkedWheelEvent).__viewportNavSynthetic) return;
		if (!enabled() || !controls.enabled) return;

		event.preventDefault();
		event.stopImmediatePropagation();
		dispatchWheel(event, resolveAction(event, zoom));
	};

	dom.addEventListener('wheel', onWheelCapture, { capture: true, passive: false });

	return () => {
		dom.removeEventListener('wheel', onWheelCapture, { capture: true });
		controls.mouseButtons.wheel = savedWheel;
	};
}

/**
 * Perspective: **dolly** moves the camera toward/away from the orbit target (the
 * old scroll-wheel feel). **Zoom** changes focal length / ortho scale instead.
 *
 * camera-controls forces pinch (ctrlKey wheel) to ZOOM; we remap pinch, Cmd+scroll,
 * and mouse wheel to dolly so zoom matches the original scroll behavior and
 * dollyToCursor anchors on the pointer.
 */
export function bindStudioViewportNavigation({
	controls,
	dom,
	isOrtho,
	enabled = () => true
}: ViewportNavigationOptions): () => void {
	const savedLeft = controls.mouseButtons.left;

	const unbindWheel = bindWheelRouting({
		controls,
		dom,
		isOrtho,
		enabled,
		resolveAction: (event, zoom) => {
			if (isZoomWheel(event) || isMouseWheel(event)) return zoom;
			if (isTrackpadGesture(event) && event.altKey) return CameraControls.ACTION.ROTATE;
			return CameraControls.ACTION.TRUCK;
		}
	});

	let panHeld = false;

	const setHandPan = (active: boolean) => {
		if (active) {
			controls.mouseButtons.left = CameraControls.ACTION.TRUCK;
		} else {
			controls.mouseButtons.left = savedLeft;
		}
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (!eventMatchesAction(event, 'viewportPan', inputPrefs.shortcuts)) return;
		if (event.repeat || isFormFieldFocused()) return;
		if (!enabled() || !controls.enabled) return;

		event.preventDefault();
		panHeld = true;
		setHandPan(true);
	};

	const onKeyUp = (event: KeyboardEvent) => {
		if (!eventMatchesAction(event, 'viewportPan', inputPrefs.shortcuts)) return;
		if (!panHeld) return;

		panHeld = false;
		setHandPan(false);
	};

	const onBlur = () => {
		if (!panHeld) return;
		panHeld = false;
		setHandPan(false);
	};

	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	window.addEventListener('blur', onBlur);

	return () => {
		unbindWheel();
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		window.removeEventListener('blur', onBlur);
		controls.mouseButtons.left = savedLeft;
	};
}

/** Blender-style orbit: middle-drag rotate, shift+middle pan, scroll/pinch zoom. */
export function bindBlenderViewportNavigation({
	controls,
	dom,
	isOrtho,
	enabled = () => true
}: ViewportNavigationOptions): () => void {
	const saved = {
		left: controls.mouseButtons.left,
		middle: controls.mouseButtons.middle,
		right: controls.mouseButtons.right
	};

	controls.mouseButtons.left = CameraControls.ACTION.NONE;
	controls.mouseButtons.right = CameraControls.ACTION.NONE;
	controls.mouseButtons.middle = CameraControls.ACTION.ROTATE;

	const unbindWheel = bindWheelRouting({
		controls,
		dom,
		isOrtho,
		enabled,
		resolveAction: (event, zoom) => {
			if (isZoomWheel(event) || isMouseWheel(event)) return zoom;
			// Trackpad: two-finger swipe orbits; shift mirrors shift+middle pan.
			if (event.shiftKey) return CameraControls.ACTION.TRUCK;
			return CameraControls.ACTION.ROTATE;
		}
	});

	let middleActive = false;
	let shiftHeld = false;

	const applyMiddleAction = () => {
		if (!middleActive || !enabled() || !controls.enabled) return;
		controls.mouseButtons.middle = shiftHeld
			? CameraControls.ACTION.TRUCK
			: CameraControls.ACTION.ROTATE;
	};

	const onPointerDown = (event: PointerEvent) => {
		if (event.button !== 1) return;
		if (!enabled() || !controls.enabled) return;
		event.preventDefault();
		middleActive = true;
		shiftHeld = event.shiftKey;
		applyMiddleAction();
	};

	const onPointerUp = (event: PointerEvent) => {
		if (event.button !== 1) return;
		middleActive = false;
		controls.mouseButtons.middle = CameraControls.ACTION.ROTATE;
	};

	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Shift') return;
		shiftHeld = true;
		applyMiddleAction();
	};

	const onKeyUp = (event: KeyboardEvent) => {
		if (event.key !== 'Shift') return;
		shiftHeld = false;
		applyMiddleAction();
	};

	const onBlur = () => {
		middleActive = false;
		shiftHeld = false;
		controls.mouseButtons.middle = CameraControls.ACTION.ROTATE;
	};

	window.addEventListener('pointerdown', onPointerDown, true);
	window.addEventListener('pointerup', onPointerUp, true);
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	window.addEventListener('blur', onBlur);

	return () => {
		unbindWheel();
		window.removeEventListener('pointerdown', onPointerDown, true);
		window.removeEventListener('pointerup', onPointerUp, true);
		window.removeEventListener('keydown', onKeyDown);
		window.removeEventListener('keyup', onKeyUp);
		window.removeEventListener('blur', onBlur);

		controls.mouseButtons.left = saved.left;
		controls.mouseButtons.middle = saved.middle;
		controls.mouseButtons.right = saved.right;
	};
}

/** @deprecated Use bindStudioViewportNavigation */
export const bindFigmaViewportNavigation = bindStudioViewportNavigation;

export function bindViewportNavigation(options: ViewportNavigationOptions): () => void {
	const scheme = options.scheme ?? inputPrefs.navigationScheme;
	if (scheme === 'blender') {
		return bindBlenderViewportNavigation(options);
	}
	return bindStudioViewportNavigation(options);
}

// Exported for tests / gesture docs.
export const wheelGesture = {
	isZoomWheel,
	/** @deprecated Use isZoomWheel — pinch and Cmd+scroll both zoom. */
	isPinchZoom: isZoomWheel,
	isMouseWheel,
	isTrackpadGesture
};
