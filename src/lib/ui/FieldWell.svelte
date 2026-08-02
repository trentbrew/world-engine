<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		disabled?: boolean;
		dirty?: boolean;
		title?: string;
		class?: string;
		ondblclick?: (event: MouseEvent) => void;
		children: Snippet;
	}

	let {
		disabled = false,
		dirty = false,
		title,
		class: className = '',
		ondblclick,
		children
	}: Props = $props();
</script>

<div
	class="field-well {className}"
	class:field-well--dirty={dirty}
	class:field-well--disabled={disabled}
	{title}
	{ondblclick}
>
	{@render children()}
</div>
