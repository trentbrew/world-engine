/** Parse authored color strings (#rgb, #rrggbb, #rrggbbaa, rgba) for Three.js materials. */

export type ParsedColor = {
	hex: string;
	opacity: number;
	raw: string;
};

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function expandHex(hex: string): string {
	if (hex.length === 3) {
		return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
	}
	return `#${hex}`;
}

export function parseColor(input: string): ParsedColor {
	const raw = input.trim();
	if (!raw) return { hex: '#ffffff', opacity: 1, raw: '#ffffff' };

	const rgbaMatch = raw.match(
		/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
	);
	if (rgbaMatch) {
		const r = Math.round(Number(rgbaMatch[1]));
		const g = Math.round(Number(rgbaMatch[2]));
		const b = Math.round(Number(rgbaMatch[3]));
		const a = rgbaMatch[4] !== undefined ? clamp01(Number(rgbaMatch[4])) : 1;
		const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
		return {
			hex,
			opacity: a,
			raw: a < 1 ? `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}` : hex
		};
	}

	if (raw.startsWith('#')) {
		const body = raw.slice(1);
		if (body.length === 8) {
			const hex = expandHex(body.slice(0, 6));
			const opacity = clamp01(parseInt(body.slice(6, 8), 16) / 255);
			return { hex, opacity, raw };
		}
		if (body.length === 6 || body.length === 3) {
			const hex = expandHex(body);
			return { hex, opacity: 1, raw: hex };
		}
	}

	return { hex: raw.startsWith('#') ? raw : `#${raw}`, opacity: 1, raw };
}

export function formatColor(hex: string, opacity: number): string {
	const normalized = parseColor(hex).hex;
	if (opacity >= 0.999) return normalized;
	const alpha = Math.round(clamp01(opacity) * 255)
		.toString(16)
		.padStart(2, '0');
	return `${normalized}${alpha}`;
}

export function swatchHex(value: string): string {
	return parseColor(value).hex;
}
