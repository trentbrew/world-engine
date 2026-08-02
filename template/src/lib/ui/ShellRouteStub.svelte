<script lang="ts">
	interface Props {
		title: string;
		hint: string;
	}

	let { title, hint }: Props = $props();
</script>

<div class="route-stub" role="status">
	<h2>{title}</h2>
	<p>{hint}</p>
</div>

<style>
	.route-stub {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--spacing-lg);
		text-align: center;
		gap: 8px;
		background: var(--viewport);
	}

	h2 {
		margin: 0;
		font-size: 15px;
	}

	p {
		margin: 0;
		max-width: 36ch;
		font-size: 12px;
		color: var(--muted-foreground);
	}
</style>
