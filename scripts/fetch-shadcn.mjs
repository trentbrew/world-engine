import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const components = ['utils', 'button', 'input', 'label', 'dialog', 'tooltip', 'sonner', 'form'];

function fix(content) {
	return content
		.replace(/\$UTILS\$\.js/g, '$lib/utils.js')
		.replace(/\$UI\$/g, '$lib/components/ui')
		.replace(/VariantProps \["variant"\]/g, 'VariantProps<typeof buttonVariants>["variant"]')
		.replace(/VariantProps \["size"\]/g, 'VariantProps<typeof buttonVariants>["size"]')
		.replace(/WithElementRef &\n\t\tWithElementRef/g, 'WithElementRef<HTMLButtonAttributes>')
		.replace(/WithElementRef<HTMLAttributes > /g, 'WithElementRef<HTMLAttributes<HTMLDivElement>> ')
		.replace(/WithoutChildrenOrChild<DialogPrimitive\.ContentProps> /g, 'WithoutChildrenOrChild<DialogPrimitive.ContentProps> ')
		.replace(/WithoutChildrenOrChild<ComponentProps >/g, 'WithoutChildrenOrChild<ComponentProps<typeof DialogPortal>>')
		.replace(/WithoutChildren<WithElementRef<HTMLAttributes >>/g, 'WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>>')
		.replace(/FormPrimitive\.ElementFieldProps<T, U>/g, 'FormPrimitive.ElementFieldProps<T, U>')
		.replace(/WithoutChildren<WithElementRef<HTMLAttributes >> &\n\t\tFormPrimitive\.ElementFieldProps/g, 'WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> &\n\t\tFormPrimitive.ElementFieldProps')
		.replace(/FormPrimitive\.FieldProps<T, U> &\n\t\tWithoutChildren<WithElementRef<HTMLAttributes >>/g, 'FormPrimitive.FieldProps<T, U> &\n\t\tWithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>>')
		.replace(/WithoutChild<FormPrimitive\.FieldsetProps<T, U>>/g, 'WithoutChild<FormPrimitive.FieldsetProps<T, U>>');
}

for (const name of components) {
	const res = await fetch(`https://shadcn-svelte.com/registry/${name}.json`);
	if (!res.ok) throw new Error(`Failed ${name}: ${res.status}`);
	const json = await res.json();
	for (const file of json.files) {
		const target = file.target;
		const out =
			target === 'utils.ts'
				? path.join(root, 'src/lib/utils.ts')
				: path.join(root, 'src/lib/components/ui', target);
		fs.mkdirSync(path.dirname(out), { recursive: true });
		fs.writeFileSync(out, fix(file.content));
		console.log('wrote', out);
	}
}
