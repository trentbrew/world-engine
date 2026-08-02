export const PEER_COLORS = [
	'#0f62fe',
	'#ee5396',
	'#42be65',
	'#ff832b',
	'#a56eff',
	'#08bdba'
] as const;

export function peerColor(clientId: string): string {
	let h = 0;
	for (let i = 0; i < clientId.length; i++) h = (h * 31 + clientId.charCodeAt(i)) >>> 0;
	return PEER_COLORS[h % PEER_COLORS.length];
}

export function peerDisplayName(clientId: string, username = ''): string {
	const trimmed = username.trim();
	if (trimmed) return trimmed;
	const tail = clientId.slice(-4) || '????';
	return `Peer ${tail}`;
}

export function peerInitials(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return '??';
	const parts = trimmed.split(/\s+/).filter(Boolean);
	if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
	return trimmed.slice(0, 2).toUpperCase();
}
