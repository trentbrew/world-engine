/** Persisted world-rail item order (Config stays pinned at the end). */

import {
	DEFAULT_RAIL_ORDER,
	moveRailOrderItem,
	normalizeRailOrder,
	orderedWorldRoutes,
	type WorldNavItem
} from '$lib/ui/worldNav';
import type { WorldRoute } from '$lib/ui/ui.svelte';

const RAIL_ORDER_KEY = 'playlab:rail-order';

function loadRailOrder(): WorldRoute[] {
	if (typeof localStorage === 'undefined') return [...DEFAULT_RAIL_ORDER];
	try {
		const raw = localStorage.getItem(RAIL_ORDER_KEY);
		if (!raw) return [...DEFAULT_RAIL_ORDER];
		return normalizeRailOrder(JSON.parse(raw));
	} catch {
		return [...DEFAULT_RAIL_ORDER];
	}
}

function persistRailOrder(order: WorldRoute[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(RAIL_ORDER_KEY, JSON.stringify(order));
}

class RailOrderState {
	order = $state<WorldRoute[]>(loadRailOrder());

	get items(): WorldNavItem[] {
		return orderedWorldRoutes(this.order);
	}

	setOrder(order: WorldRoute[]) {
		this.order = normalizeRailOrder(order);
		persistRailOrder(this.order);
	}

	moveItem(fromId: WorldRoute, toId: WorldRoute) {
		if (fromId === toId || fromId === 'config' || toId === 'config') return;
		this.setOrder(moveRailOrderItem(this.order, fromId, toId));
	}

	reset() {
		this.setOrder([...DEFAULT_RAIL_ORDER]);
	}
}

export const railOrder = new RailOrderState();
