/** In-app back/forward stack for edit-shell route navigation. */

import type { RailRoute } from '$lib/ui/ui.svelte';

export type ShellNavFrame = {
	railRoute: RailRoute;
	selectedObjectType: string | null;
	objectTarget: string | null;
};

const MAX_ENTRIES = 64;

function framesEqual(a: ShellNavFrame, b: ShellNavFrame): boolean {
	return (
		a.railRoute === b.railRoute &&
		a.selectedObjectType === b.selectedObjectType &&
		a.objectTarget === b.objectTarget
	);
}

class ShellNavHistory {
	stack = $state.raw<ShellNavFrame[]>([]);
	index = $state(-1);
	/** True while applying a back/forward restore — callers skip recording. */
	restoring = $state(false);

	get canGoBack(): boolean {
		return this.index > 0;
	}

	get canGoForward(): boolean {
		return this.index >= 0 && this.index < this.stack.length - 1;
	}

	get current(): ShellNavFrame | null {
		if (this.index < 0 || this.index >= this.stack.length) return null;
		return this.stack[this.index] ?? null;
	}

	/** Seed the stack when empty so the first navigation has a back target. */
	ensureSeed(frame: ShellNavFrame) {
		if (this.stack.length === 0) {
			this.stack = [frame];
			this.index = 0;
		}
	}

	/** Push a new frame after user navigation. Drops any forward branch. */
	record(frame: ShellNavFrame) {
		if (this.restoring) return;
		const cur = this.current;
		if (cur && framesEqual(cur, frame)) return;

		const next = this.stack.slice(0, this.index + 1);
		next.push(frame);
		while (next.length > MAX_ENTRIES) next.shift();
		this.stack = next;
		this.index = next.length - 1;
	}

	back(): ShellNavFrame | null {
		if (!this.canGoBack) return null;
		this.index -= 1;
		return this.current;
	}

	forward(): ShellNavFrame | null {
		if (!this.canGoForward) return null;
		this.index += 1;
		return this.current;
	}
}

export const shellNavHistory = new ShellNavHistory();
