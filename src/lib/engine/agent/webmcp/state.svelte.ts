import { WEBMCP_TOOLS } from './manifest';
import { probeWebMcpSupport } from './support';

export type WebMcpStatus = 'pending' | 'ready' | 'unsupported';

function initialStatus(): WebMcpStatus {
	if (typeof document === 'undefined') return 'pending';
	return probeWebMcpSupport() ? 'pending' : 'unsupported';
}

class WebMcpState {
	status = $state<WebMcpStatus>(initialStatus());
	registeredCount = $state(0);
	readonly expectedCount = WEBMCP_TOOLS.length;

	setRegistrationResult(supported: boolean, registered: string[]) {
		this.registeredCount = registered.length;
		if (supported && registered.length > 0) {
			this.status = 'ready';
			return;
		}
		this.status = 'unsupported';
	}

	reset() {
		this.status = initialStatus();
		this.registeredCount = 0;
	}
}

export const webmcp = new WebMcpState();
