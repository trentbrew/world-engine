import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fix(content) {
	return content
		.replace(/\$UTILS\$\.js/g, '$lib/utils.js')
		.replace(/\$UI\$/g, '$lib/components/ui')
		.replace(/WithElementRef<HTMLAttributes >/g, 'WithElementRef<HTMLAttributes<HTMLDivElement>>')
		.replace(
			/WithoutChildrenOrChild<ComponentProps >/g,
			'WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>'
		);
}

for (const name of ['dialog', 'tooltip']) {
	const json = JSON.parse(fs.readFileSync(path.join(root, `tmp-${name}.json`), 'utf8'));
	for (const file of json.files) {
		const out = path.join(root, 'src/lib/components/ui', file.target);
		fs.mkdirSync(path.dirname(out), { recursive: true });
		fs.writeFileSync(out, fix(file.content));
		console.log('wrote', file.target);
	}
}
