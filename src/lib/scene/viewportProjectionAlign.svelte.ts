import { useThrelte } from '@threlte/core';
import type { PerspectiveCamera } from 'three';
import { ui } from '$lib/ui/ui.svelte';
import {
	applyPerspectiveViewOffset,
	computeProjectionCenterOffset
} from '$lib/scene/viewportProjection';

/** Keep preview/stage cameras centered in the visible gap between floating panels. */
export function useViewportProjectionAlign(getCamera: () => PerspectiveCamera | undefined) {
	const { invalidate, renderer } = useThrelte();

	$effect(() => {
		const camera = getCamera();
		const dom = renderer.domElement;
		if (!camera || !dom) return;

		const insets = ui.viewportChromeInsets;
		void ui.leftPanelWidth;
		void ui.rightPanelWidth;
		void ui.railRoute;
		void ui.sidebarsVisible;
		void ui.bottomPaneOpen;
		void ui.bottomPaneHeight;
		void ui.objectInspectorTab;

		const apply = () => {
			const offset = computeProjectionCenterOffset(dom, insets);
			// Use the canvas size — not the window — so CSS-inset viewports keep correct aspect.
			const rect = dom.getBoundingClientRect();
			applyPerspectiveViewOffset(camera, offset.x, offset.y, rect.width, rect.height);
			invalidate();
		};

		apply();
		window.addEventListener('resize', apply);
		const ro = new ResizeObserver(apply);
		ro.observe(dom);

		return () => {
			window.removeEventListener('resize', apply);
			ro.disconnect();
			camera.clearViewOffset();
			camera.updateProjectionMatrix();
		};
	});
}
