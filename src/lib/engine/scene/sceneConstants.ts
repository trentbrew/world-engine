/**
 * Pure scene-document identifiers — no UI/runtime imports, so durable-tier modules
 * (graphDiff, durableStore) can reference them without dragging in the editor UI
 * chain (sceneDocument → ui.svelte → systems → player/input → @lucide/svelte).
 */
export const SCENE_SETTINGS_ENTITY_ID = 'entity:scene/settings';
export const SCENE_SETTINGS_COMPONENT = 'EditorScene';
export const SCENE_SETTINGS_FIELD = 'document';
export const SCENE_DOCUMENT_VERSION = 1 as const;
