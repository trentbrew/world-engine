<script lang="ts">
  import * as Accordion from '$lib/components/ui/accordion/index.js';
  import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
  import {
    camera,
    DEFAULT_CONTROL_PREFS,
  } from '$lib/engine/render/camera.svelte';
  import { getMappingTable } from '$lib/engine/player/gamepad.svelte';
  import {
    FOLLOW_CAMERA_PRESET_OPTIONS,
    followCameraPreset,
    type FollowCameraPresetId,
  } from '$lib/engine/player/playInput';
  import { playInputState } from '$lib/engine/player/playInputState.svelte';
  import InspectorField from '$lib/ui/InspectorField.svelte';
  import {
    NONE_ON_OPTIONS,
    applySkySelect,
    boolToNoneOn,
    noneOnToBool,
    skySelectOptions,
    skySelectValue,
  } from '$lib/ui/inspectorOptions';
  import CameraSceneFields from '$lib/ui/scene/CameraSceneFields.svelte';
  import ShadersSceneFields from '$lib/ui/scene/ShadersSceneFields.svelte';
  import CollaborationSection from '$lib/ui/CollaborationSection.svelte';
  import { ui, DEFAULT_GRID, DEFAULT_GROUND_GRID } from '$lib/ui/ui.svelte';

  const skyPresetOptions = skySelectOptions;

  const skyPickerValue = $derived(
    skySelectValue(ui.scene.sky.enabled, ui.scene.sky.preset),
  );

  const mappings = getMappingTable();

  let openSections = $state<string[]>(['essentials', 'environment']);
  let gridTab = $state<'reference' | 'ground'>('reference');
</script>

<div class="scene-inspector">
  <Accordion.Root
    type="multiple"
    bind:value={openSections}
    class="inspector-accordion"
  >
    <Accordion.Item value="essentials">
      <Accordion.Trigger class="inspector-trigger">Essentials</Accordion.Trigger
      >
      <Accordion.Content class="inspector-content">
        <InspectorField
          id="scene-name"
          label="name"
          value={ui.scene.displayName}
          onChange={(value) => ui.setSceneDisplayName(String(value))}
        />
        <InspectorField
          id="scene-background"
          label="background"
          kind="color"
          value={ui.scene.background}
          onChange={(value) => (ui.scene.background = String(value))}
        />
      </Accordion.Content>
    </Accordion.Item>

    <Accordion.Item value="environment">
      <Accordion.Trigger class="inspector-trigger"
        >Environment</Accordion.Trigger
      >
      <Accordion.Content class="inspector-content">
        <InspectorField
          id="scene-sky-preset"
          label="sky"
          kind="select"
          value={skyPickerValue}
          options={skyPresetOptions}
          onChange={(value) => {
            const next = applySkySelect(String(value));
            ui.scene.sky.enabled = next.enabled;
            ui.scene.sky.preset = next.preset;
          }}
        />
        {#if ui.scene.sky.enabled}
          <InspectorField
            id="scene-sky-env"
            label="environment"
            kind="select"
            value={boolToNoneOn(ui.scene.sky.setEnvironment)}
            options={[...NONE_ON_OPTIONS]}
            onChange={(value) =>
              (ui.scene.sky.setEnvironment = noneOnToBool(value))}
          />
        {/if}
        <InspectorField
          id="scene-shadows"
          label="shadows"
          kind="select"
          value={boolToNoneOn(ui.scene.shadows)}
          options={[...NONE_ON_OPTIONS]}
          onChange={(value) => (ui.scene.shadows = noneOnToBool(value))}
        />
      </Accordion.Content>
    </Accordion.Item>

    <Accordion.Item value="look-shaders">
      <Accordion.Trigger class="inspector-trigger"
        >Look &amp; shaders</Accordion.Trigger
      >
      <Accordion.Content class="inspector-content">
        <ShadersSceneFields />
      </Accordion.Content>
    </Accordion.Item>

    <Accordion.Item value="play-mode">
      <Accordion.Trigger class="inspector-trigger">Play mode</Accordion.Trigger>
      <Accordion.Content class="inspector-content">
        <div class="toggle-field">
          <ToggleGroup.Root
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            class="inspector-toggle-group"
            value={ui.playCameraDefault}
            onValueChange={(value) => {
              if (value === 'follow' || value === 'orbit')
                ui.playCameraDefault = value;
            }}
          >
            <ToggleGroup.Item value="follow">Follow</ToggleGroup.Item>
            <ToggleGroup.Item value="orbit">Orbit</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
        <InspectorField
          id="play-follow-preset"
          label="follow preset"
          kind="select"
          value={playInputState.config.followCamera.preset}
          options={FOLLOW_CAMERA_PRESET_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          onChange={(value) => {
            const preset = String(value) as FollowCameraPresetId;
            playInputState.applyConfig({
              ...playInputState.config,
              followCamera: followCameraPreset(preset),
            });
          }}
        />
      </Accordion.Content>
    </Accordion.Item>

    <Accordion.Item value="grids">
      <Accordion.Trigger class="inspector-trigger">Grids</Accordion.Trigger>
      <Accordion.Content class="inspector-content">
        <div class="toggle-field">
          <ToggleGroup.Root
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            class="inspector-toggle-group"
            aria-label="Grid type"
            value={gridTab}
            onValueChange={(value) => {
              if (value === 'reference' || value === 'ground') gridTab = value;
            }}
          >
            <ToggleGroup.Item value="reference">Reference</ToggleGroup.Item>
            <ToggleGroup.Item value="ground">On ground</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>

        {#if gridTab === 'reference'}
          <InspectorField
            id="ref-grid-show"
            label="grid"
            kind="select"
            value={boolToNoneOn(ui.chrome.grid)}
            options={[...NONE_ON_OPTIONS]}
            onChange={(value) => (ui.chrome.grid = noneOnToBool(value))}
          />
          {#if ui.chrome.grid}
            <InspectorField
              id="ref-grid-infinite"
              label="infinite"
              kind="boolean"
              value={ui.grid.infinite}
              onChange={(value) => (ui.grid.infinite = Boolean(value))}
            />
            <InspectorField
              id="ref-grid-cell"
              label="cell"
              kind="slider"
              min={0.5}
              max={5}
              step={0.5}
              defaultValue={DEFAULT_GRID.cellSize}
              value={ui.grid.cellSize}
              onChange={(value) =>
                (ui.grid.cellSize = Number(value) ?? DEFAULT_GRID.cellSize)}
            />
            <InspectorField
              id="ref-grid-section"
              label="section"
              kind="slider"
              min={2}
              max={50}
              step={1}
              defaultValue={DEFAULT_GRID.sectionSize}
              value={ui.grid.sectionSize}
              onChange={(value) =>
                (ui.grid.sectionSize =
                  Number(value) ?? DEFAULT_GRID.sectionSize)}
            />
            <InspectorField
              id="ref-grid-fade"
              label="fade"
              kind="slider"
              min={20}
              max={200}
              step={10}
              defaultValue={DEFAULT_GRID.fadeDistance}
              value={ui.grid.fadeDistance}
              onChange={(value) =>
                (ui.grid.fadeDistance =
                  Number(value) ?? DEFAULT_GRID.fadeDistance)}
            />
            <InspectorField
              id="ref-grid-cell-color"
              label="cell"
              kind="color"
              value={ui.grid.cellColor}
              onChange={(value) => (ui.grid.cellColor = String(value))}
            />
            <InspectorField
              id="ref-grid-section-color"
              label="section"
              kind="color"
              value={ui.grid.sectionColor}
              onChange={(value) => (ui.grid.sectionColor = String(value))}
            />
          {/if}
        {:else}
          <InspectorField
            id="ground-grid-show"
            label="grid"
            kind="select"
            value={boolToNoneOn(ui.scene.groundGrid.enabled)}
            hint="Grid drawn on ground planes — tuned for dark surfaces."
            options={[...NONE_ON_OPTIONS]}
            onChange={(value) =>
              (ui.scene.groundGrid.enabled = noneOnToBool(value))}
          />
          {#if ui.scene.groundGrid.enabled}
            <InspectorField
              id="ground-grid-cell"
              label="cell"
              kind="slider"
              min={0.5}
              max={5}
              step={0.5}
              defaultValue={DEFAULT_GROUND_GRID.cellSize}
              value={ui.scene.groundGrid.cellSize}
              onChange={(value) =>
                (ui.scene.groundGrid.cellSize =
                  Number(value) ?? DEFAULT_GROUND_GRID.cellSize)}
            />
            <InspectorField
              id="ground-grid-section"
              label="section"
              kind="slider"
              min={2}
              max={20}
              step={1}
              defaultValue={DEFAULT_GROUND_GRID.sectionSize}
              value={ui.scene.groundGrid.sectionSize}
              onChange={(value) =>
                (ui.scene.groundGrid.sectionSize =
                  Number(value) ?? DEFAULT_GROUND_GRID.sectionSize)}
            />
            <InspectorField
              id="ground-grid-cell-color"
              label="cell"
              kind="color"
              value={ui.scene.groundGrid.cellColor}
              onChange={(value) =>
                (ui.scene.groundGrid.cellColor = String(value))}
            />
            <InspectorField
              id="ground-grid-section-color"
              label="section"
              kind="color"
              value={ui.scene.groundGrid.sectionColor}
              onChange={(value) =>
                (ui.scene.groundGrid.sectionColor = String(value))}
            />
          {/if}
        {/if}
      </Accordion.Content>
    </Accordion.Item>

    <Accordion.Item value="selection">
      <Accordion.Trigger class="inspector-trigger">Selection</Accordion.Trigger>
      <Accordion.Content class="inspector-content">
        <InspectorField
          id="scene-selection-outline"
          label="outline"
          kind="select"
          value={boolToNoneOn(ui.chrome.selectionOutline)}
          options={[...NONE_ON_OPTIONS]}
          onChange={(value) =>
            (ui.chrome.selectionOutline = noneOnToBool(value))}
        />
      </Accordion.Content>
    </Accordion.Item>

    <Accordion.Item value="developer">
      <Accordion.Trigger class="inspector-trigger">Developer</Accordion.Trigger>
      <Accordion.Content class="inspector-content">
        <InspectorField
          id="scene-stats-hud"
          label="Developer HUD"
          kind="select"
          value={boolToNoneOn(ui.chrome.statsHud)}
          options={[...NONE_ON_OPTIONS]}
          onChange={(value) => (ui.chrome.statsHud = noneOnToBool(value))}
        />
        <div class="nested-section">
          <details>
            <summary>Camera controls</summary>
            <CameraSceneFields />
          </details>
        </div>
        <div class="nested-section">
          <details>
            <summary>Input &amp; camera reference</summary>
            <div class="reference-panel">
              <p class="panel-label">Controller mappings (read-only)</p>
              <table class="mapping-table">
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {#each mappings as row (row.control)}
                    <tr>
                      <td>{row.control}</td>
                      <td>{row.source}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
              <p class="panel-label">Camera defaults</p>
              <dl class="defaults-list">
                <div>
                  <dt>Orbit speed</dt>
                  <dd>{DEFAULT_CONTROL_PREFS.rotateSpeed}</dd>
                </div>
                <div>
                  <dt>Zoom speed</dt>
                  <dd>{DEFAULT_CONTROL_PREFS.dollySpeed}</dd>
                </div>
                <div>
                  <dt>Edit mode camera</dt>
                  <dd>Orbit</dd>
                </div>
                <div>
                  <dt>Play mode camera</dt>
                  <dd>Follow (when player exists)</dd>
                </div>
              </dl>
              <p class="hint">Current mode: {camera.mode}</p>
            </div>
          </details>
        </div>
      </Accordion.Content>
    </Accordion.Item>

    <Accordion.Item value="collaboration">
      <Accordion.Trigger class="inspector-trigger"
        >Collaboration</Accordion.Trigger
      >
      <Accordion.Content class="inspector-content">
        <CollaborationSection embedded />
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
</div>

<style>
  .scene-inspector {
    min-height: 0;
  }

  :global(.inspector-accordion) {
    padding: var(--spacing-sm) var(--spacing-md);
  }

  :global(.inspector-accordion [data-slot='accordion-item']) {
    border-bottom-color: color-mix(in srgb, var(--border) 20%, transparent);
    background: color-mix(in srgb, var(--muted) 8%, transparent);
    border-radius: 8px;
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  :global(.inspector-trigger) {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--foreground) 72%, var(--muted-foreground));
    padding-left: 0;
    padding-right: 0;
    position: sticky;
    top: 0;
    background: transparent;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    z-index: 10;
  }

  :global(.inspector-trigger:hover) {
    color: var(--foreground);
    text-decoration: none;
  }

  :global(.inspector-content) {
    padding-left: var(--spacing-md);
    padding-right: 0;
    padding-top: var(--spacing-xs);
  }

  .toggle-field {
    margin-bottom: 6px;
  }

  .nested-section {
    margin-top: var(--spacing-sm);
    font-size: 12px;
  }

  .nested-section summary {
    cursor: pointer;
    color: var(--muted-foreground);
    font-size: 11px;
    margin-bottom: 6px;
    user-select: none;
  }

  .nested-section summary:hover {
    color: var(--foreground);
  }

  .reference-panel {
    padding-top: 4px;
  }

  .panel-label {
    font-size: 11px;
    color: var(--muted-foreground);
    margin: 0 0 var(--spacing-sm);
  }

  .mapping-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    font-family: var(--font-mono);
    margin-bottom: var(--spacing-sm);
  }

  .mapping-table th,
  .mapping-table td {
    text-align: left;
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
  }

  .mapping-table th {
    color: var(--muted-foreground);
    font-weight: 500;
  }

  .defaults-list {
    margin: 0;
    font-size: 12px;
  }

  .defaults-list div {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px solid var(--border);
  }

  .defaults-list dt {
    color: var(--muted-foreground);
  }

  .defaults-list dd {
    margin: 0;
  }

  .hint {
    margin-top: var(--spacing-sm);
    font-size: 11px;
    color: var(--muted-foreground);
  }
</style>
