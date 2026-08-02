/** Context for SkinnedMeshView when rendered on the Object preview stage. */
export const OBJECT_STAGE_KEY = Symbol('objectStage');

export type ObjectStageContext = {
	/** Force mesh at origin; hide world transform + gizmo. */
	atOrigin: true;
	/** Local preview playback — does not write Mesh3DAnimator.playing to world. */
	previewPlaying: boolean;
	/** Preview canvases have no Rapier world — skip PhysicsBody wrapper. */
	skipPhysics?: boolean;
};
