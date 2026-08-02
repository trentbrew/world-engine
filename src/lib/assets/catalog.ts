export type AssetKind = 'models' | 'textures' | 'audio' | 'files';

const FILE_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv'] as const;
const FILE_DOC_EXTENSIONS = [
	'.pdf',
	'.txt',
	'.md',
	'.json',
	'.csv',
	'.xml',
	'.html',
	'.htm'
] as const;
const FILE_MISC_EXTENSIONS = ['.zip'] as const;

export type AssetEntry = {
	kind: AssetKind;
	name: string;
	url: string;
	size?: number;
};

export type AssetRoot = {
	kind: AssetKind;
	dir: string;
	extensions: string[];
	accept: string;
};

export const ASSET_ROOTS: AssetRoot[] = [
	{ kind: 'models', dir: 'models', extensions: ['.glb', '.gltf'], accept: '.glb,.gltf' },
	{
		kind: 'textures',
		dir: 'textures',
		extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.hdr'],
		accept: '.png,.jpg,.jpeg,.webp,.gif,.hdr,image/*'
	},
	{
		kind: 'audio',
		dir: 'audio',
		extensions: ['.mp3', '.ogg', '.wav', '.m4a'],
		accept: '.mp3,.ogg,.wav,.m4a,audio/*'
	},
	{
		kind: 'files',
		dir: 'files',
		extensions: [
			...FILE_VIDEO_EXTENSIONS,
			...FILE_DOC_EXTENSIONS,
			...FILE_MISC_EXTENSIONS
		],
		accept:
			'.mp4,.webm,.mov,.m4v,.ogv,.pdf,.txt,.md,.json,.csv,.xml,.html,.htm,.zip,video/*,application/pdf,text/*'
	}
];

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
	models: 'Models',
	textures: 'Textures',
	audio: 'Audio',
	files: 'Files'
};

export const ASSET_KIND_ORDER: AssetKind[] = ['models', 'textures', 'audio', 'files'];

export function fileExtension(name: string): string {
	const lower = name.toLowerCase();
	const dot = lower.lastIndexOf('.');
	return dot >= 0 ? lower.slice(dot) : '';
}

export function isVideoFile(name: string): boolean {
	return (FILE_VIDEO_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function isDocumentFile(name: string): boolean {
	return (FILE_DOC_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function assetRootForKind(kind: AssetKind): AssetRoot {
	const root = ASSET_ROOTS.find((entry) => entry.kind === kind);
	if (!root) throw new Error(`Unknown asset kind: ${kind}`);
	return root;
}

export function sortAssets(assets: AssetEntry[]): AssetEntry[] {
	return [...assets].sort(
		(a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
	);
}

export async function fetchAssets(): Promise<AssetEntry[]> {
	const res = await fetch('/api/assets');
	if (!res.ok) throw new Error('Failed to load assets');
	const data = (await res.json()) as { assets: AssetEntry[] };
	return data.assets;
}

export async function uploadAsset(kind: AssetKind, file: File): Promise<AssetEntry> {
	const form = new FormData();
	form.set('kind', kind);
	form.set('file', file);

	const res = await fetch('/api/assets', { method: 'POST', body: form });
	if (!res.ok) {
		const body = (await res.json().catch(() => null)) as { message?: string } | null;
		throw new Error(body?.message ?? 'Upload failed');
	}

	const data = (await res.json()) as { asset: AssetEntry };
	return data.asset;
}

export function formatBytes(bytes?: number): string {
	if (bytes == null) return '';
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
