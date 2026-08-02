/** Ephemeral follow-cam orbit angles — per viewer, reset on play enter. */

class FollowCameraState {
	yaw = 0;
	pitch = 0.35;

	reset() {
		this.yaw = 0;
		this.pitch = 0.35;
	}
}

export const followCamera = new FollowCameraState();
