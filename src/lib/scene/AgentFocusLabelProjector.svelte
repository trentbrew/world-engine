<script lang="ts">
  import { useTask, useThrelte } from '@threlte/core';
  import { Vector3 } from 'three';
  import { activeAgentFocus } from '$lib/engine/agent/agentFocus.svelte';
  import { peerColor } from '$lib/engine/collab/peerColor';
  import {
    agentFocusLabels,
    type ProjectedAgentBadge,
  } from '$lib/engine/render/agentFocusLabels.svelte';
  import { badgeAnchorForEntity } from '$lib/engine/render/selectionBadge';
  import { world } from '$lib/engine/runtime/world.svelte';
  import { ui } from '$lib/ui/ui.svelte';

  type BadgeSource = {
    key: string;
    entityId: string;
    displayName: string;
    color: string;
  };

  const { camera, size } = useThrelte();
  const anchor = new Vector3();

  const badges = $derived.by((): BadgeSource[] => {
    if (!ui.chrome.agentFocus) return [];

    const showInEdit = ui.shellMode === 'edit' && ui.chrome.selectionOutline;
    const showInPlay = ui.shellMode === 'play';
    if (!showInEdit && !showInPlay) return [];

    const result: BadgeSource[] = [];
    for (const entry of activeAgentFocus()) {
      for (const entityId of entry.entityIds) {
        if (!world.canTransformEntity(entityId)) continue;
        result.push({
          key: `${entry.agentId}:${entityId}`,
          entityId,
          displayName: entry.displayName,
          color: peerColor(entry.agentId),
        });
      }
    }
    return result;
  });

  useTask(
    () => {
      const cam = camera.current;
      const { width, height } = size.current;
      if (!ui.chrome.agentFocus || !cam || width === 0 || height === 0) {
        agentFocusLabels.clear();
        return;
      }

      const stackByEntity = new Map<string, number>();
      const projected: ProjectedAgentBadge[] = [];

      for (const badge of badges) {
        const entity = world.getEntity(badge.entityId);
        if (!entity) continue;

        const stack = stackByEntity.get(badge.entityId) ?? 0;
        stackByEntity.set(badge.entityId, stack + 1);

        const [x, y, z] = badgeAnchorForEntity(entity);
        anchor.set(x, y + stack * 0.18, z);
        anchor.project(cam);

        const visible = anchor.z >= -1 && anchor.z <= 1;
        projected.push({
          key: badge.key,
          entityId: badge.entityId,
          displayName: badge.displayName,
          color: badge.color,
          x: (anchor.x * 0.5 + 0.5) * width,
          y: (-anchor.y * 0.5 + 0.5) * height - stack * 22,
          visible,
        });
      }

      agentFocusLabels.setLabels(projected);
    },
    { autoInvalidate: false },
  );
</script>
