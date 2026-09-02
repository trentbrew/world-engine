/** Screen-space projected agent focus badges (updated from inside the Canvas). */

export type ProjectedAgentBadge = {
	key: string;
	entityId: string;
	displayName: string;
	color: string;
	x: number;
	y: number;
	visible: boolean;
};

class AgentFocusLabelProjector {
	labels = $state<ProjectedAgentBadge[]>([]);

	setLabels(labels: ProjectedAgentBadge[]) {
		this.labels = labels;
	}

	clear() {
		this.labels = [];
	}
}

export const agentFocusLabels = new AgentFocusLabelProjector();
