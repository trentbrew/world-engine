/** Screen-space projected peer selection badges (updated from inside the Canvas). */

export type ProjectedPeerBadge = {
	key: string;
	entityId: string;
	name: string;
	color: string;
	x: number;
	y: number;
	visible: boolean;
};

class PeerSelectionLabelProjector {
	labels = $state<ProjectedPeerBadge[]>([]);

	setLabels(labels: ProjectedPeerBadge[]) {
		this.labels = labels;
	}

	clear() {
		this.labels = [];
	}
}

export const peerSelectionLabels = new PeerSelectionLabelProjector();
