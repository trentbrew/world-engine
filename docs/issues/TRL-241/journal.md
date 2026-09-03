# TRL-241 — Journal

## 2026-09-02 — Spec authored (Architect)

From design TRL-240 (proposal TRL-239). Promote SceneSelector to a full-width one-row SceneCard above
LeftPanel (sibling of `.panel-shell`), driving the existing SceneSelector popover + New-scene; dedup the
doc-bar crumb (SceneSelector compact only when sidebarsVisible=false). Reuses shell chrome + selector;
no viewport-inset change. needs-e2e for card/crumb presence + popover open.
