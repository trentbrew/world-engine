<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import PlusIcon from '@lucide/svelte/icons/plus';
  import { collab } from '$lib/engine/collab/collab.svelte';
  import { peerColor } from '$lib/engine/collab/peerColor';
  import { playerClientId } from '$lib/engine/player/access';
  import { world } from '$lib/engine/runtime/world.svelte';
  import { canNudgeSelectedTransform } from '$lib/ui/shellKeyboard';
  import { ui } from '$lib/ui/ui.svelte';
  import EntityListIcon from '$lib/ui/EntityListIcon.svelte';
  import type { Entity } from '$lib/engine/ontology/schema';

  interface Props {
    search?: string;
    showFooter?: boolean;
  }

  let { search = '', showFooter = false }: Props = $props();

  let openSections = $state<string[]>(['peers', 'scene']);

  const filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return world.selectableEntities;
    return world.selectableEntities.filter((entity) =>
      entity.id.toLowerCase().includes(q),
    );
  });

  const localPlayer = $derived(world.localPlayerEntity);
  const localPlayerVisible = $derived.by(() => {
    if (!localPlayer) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      localPlayer.id.toLowerCase().includes(q) ||
      'player'.includes(q) ||
      'you'.includes(q)
    );
  });

  const peerPlayers = $derived.by(() => {
    const q = search.trim().toLowerCase();
    const peers = world.peerPlayerEntities;
    if (!q) return peers;
    return peers.filter((entity) => {
      const clientId = playerClientId(entity);
      const name = clientId ? collab.displayNameFor(clientId) : '';
      return (
        entity.id.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        (entity.type ?? '').toLowerCase().includes(q)
      );
    });
  });

  const showPeersSection = $derived(localPlayerVisible || peerPlayers.length > 0);
  const isFullyEmpty = $derived(!showPeersSection && filtered.length === 0);

  function peerLabel(entity: Entity): string {
    const clientId = playerClientId(entity);
    return clientId ? collab.displayNameFor(clientId) : shortId(entity.id);
  }

  function shortId(id: string): string {
    const parts = id.split('/');
    return parts[parts.length - 1] ?? id;
  }

  function typeDotClass(entity: Entity): string {
    if ('Player' in entity.components) return 'player';
    if ('Ground' in entity.components) return 'ground';
    if ('Marker' in entity.components) return 'spawn';
    return 'prop';
  }

  function handleKeydown(event: KeyboardEvent, index: number) {
    if (canNudgeSelectedTransform()) return;

    const entities = filtered;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = Math.min(index + 1, entities.length - 1);
      world.trySelect(entities[next].id, { notify: false });
      focusRow(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = Math.max(index - 1, 0);
      world.trySelect(entities[prev].id, { notify: false });
      focusRow(prev);
    }
  }

  function focusRow(index: number) {
    const row = document.querySelector<HTMLElement>(
      `[data-entity-index="${index}"]`,
    );
    row?.focus();
  }
</script>

<div class="entity-list-panel" aria-label="Entity list">
  <div class="entity-scroll">
    {#if isFullyEmpty}
      <p class="empty-state">{search.trim() ? 'No matches' : 'No entities'}</p>
    {:else}
      <Accordion.Root type="multiple" bind:value={openSections} class="entity-accordion">
        {#if showPeersSection}
          <Accordion.Item value="peers">
            <Accordion.Trigger class="entity-trigger">Peers</Accordion.Trigger>
            <Accordion.Content class="entity-content">
              <ul class="entity-list peers-list" role="tree" aria-label="Players">
                {#if localPlayerVisible && localPlayer}
                  <li
                    role="treeitem"
                    tabindex="0"
                    class="entity-row player-row"
                    aria-selected={world.selection === localPlayer.id}
                    onclick={() => world.trySelect(localPlayer.id)}
                    onkeydown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        world.trySelect(localPlayer.id);
                      }
                    }}
                  >
                    <EntityListIcon entity={localPlayer} dotClass="player" />
                    <span class="entity-type">Player</span>
                    <Badge variant="outline" class="entity-id-badge">you</Badge>
                  </li>
                {/if}
                {#each peerPlayers as entity (entity.id)}
                  {@const clientId = playerClientId(entity)}
                  <li
                    role="treeitem"
                    tabindex="0"
                    class="entity-row peer-row"
                    aria-selected={world.selection === entity.id}
                    onclick={() => world.trySelect(entity.id)}
                    onkeydown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        world.trySelect(entity.id);
                      }
                    }}
                  >
                    <EntityListIcon
                      entity={entity}
                      dotClass="peer"
                      dotStyle={clientId ? `background:${peerColor(clientId)}` : undefined}
                    />
                    <span class="entity-type">{peerLabel(entity)}</span>
                    <Badge variant="outline" class="entity-id-badge">player</Badge>
                  </li>
                {/each}
              </ul>
            </Accordion.Content>
          </Accordion.Item>
        {/if}

        <Accordion.Item value="scene">
          <Accordion.Trigger class="entity-trigger">Scene</Accordion.Trigger>
          <Accordion.Content class="entity-content">
            {#if filtered.length > 0}
              <ul
                id="entity-list"
                class="entity-list"
                role="tree"
                aria-label="World entities"
              >
                {#each filtered as entity, index (entity.id)}
                  <li
                    role="treeitem"
                    tabindex="0"
                    data-entity-index={index}
                    class="entity-row"
                    class:entity-row-locked={!world.canTransformEntity(entity.id)}
                    aria-selected={world.selection === entity.id}
                    onclick={() => world.trySelect(entity.id)}
                    ondblclick={(event) => {
                      if (ui.isAnimatableEntity(entity.id)) {
                        event.preventDefault();
                        ui.editObject(entity.id);
                      }
                    }}
                    onkeydown={(event) => handleKeydown(event, index)}
                  >
                    <EntityListIcon entity={entity} dotClass={typeDotClass(entity)} />
                    <span class="entity-type">{entity.type ?? 'Entity'}</span>
                    <Badge variant="outline" class="entity-id-badge"
                      >{shortId(entity.id)}</Badge
                    >
                  </li>
                {/each}
              </ul>
            {/if}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    {/if}
  </div>

  {#if showFooter}
    <div class="panel-footer">
      <Button
        variant="outline"
        size="sm"
        class="add-btn w-full gap-2"
        onclick={() => ui.addNewObjectType()}
      >
        <PlusIcon class="size-3.5" aria-hidden="true" />
        Add object
      </Button>
    </div>
  {/if}
</div>

<style>
  .entity-list-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    height: auto;
    max-height: 100%;
    width: 100%;
    flex: 0 1 auto;
  }

  .entity-scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  :global(.entity-accordion) {
    padding: 0 var(--spacing-sm) var(--spacing-sm);
  }

  :global(.entity-accordion [data-slot='accordion-item']) {
    border-bottom-color: color-mix(in srgb, var(--border) 20%, transparent);
  }

  :global(.entity-trigger) {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: normal;
    text-transform: none;
    color: var(--muted-foreground);
    padding: 4px 0;
    min-height: 0;
  }

  :global(.entity-trigger:hover) {
    color: var(--foreground);
    text-decoration: none;
  }

  :global(.entity-trigger [data-slot='accordion-trigger-icon']) {
    width: 12px;
    height: 12px;
    opacity: 0.72;
  }

  :global(.entity-content) {
    padding: 0;
  }

  .entity-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .empty-state {
    padding: var(--spacing-sm) var(--spacing-md);
    font-size: 12px;
    color: var(--muted-foreground);
    margin: 0;
  }

  .panel-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    min-height: var(--panel-shelf-height);
    box-sizing: border-box;
    padding: 0 var(--spacing-sm);
    border-top: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  }

  :global(.add-btn) {
    font-size: 12px;
    justify-content: center;
  }

  .entity-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 6px var(--spacing-sm);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 11px;
    min-width: 0;
    color: var(--muted-foreground);
  }

  .entity-row:hover {
    background: color-mix(in srgb, var(--secondary) 35%, transparent);
    color: var(--foreground);
  }

  .entity-row[aria-selected='true'] {
    background: var(--primary-muted);
    color: var(--foreground);
  }

  .entity-row-locked {
    cursor: not-allowed;
    opacity: 0.72;
  }

  .entity-row-locked:hover {
    background: transparent;
    color: var(--muted-foreground);
  }

  .entity-row[aria-selected='true'].entity-row-locked:hover {
    background: var(--primary-muted);
    color: var(--foreground);
  }

  .entity-row:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }

  .peer-row {
    font-style: normal;
  }

  .entity-type {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  :global(.entity-id-badge) {
    font-family: var(--font-mono);
    font-size: 10px;
    font-weight: 500;
    height: auto;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    color: var(--muted-foreground);
    flex-shrink: 0;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
