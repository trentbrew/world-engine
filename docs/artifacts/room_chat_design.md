---
version: alpha
name: Room chat
description: Ephemeral multiplayer room chat — FAB bottom-right, glass panel, NetTransport sync
---

# Design: Room chat

**Status:** Design complete (handoff to Architect)  
**Parent:** TRL-81 (proposal)  
**Mock:** [room_chat mock in design_system_unification_mockup.html](./design_system_unification_mockup.html) · [spec](./room_chat_spec.md)

## Overview

Lightweight text coordination for collaborators already in a room via peer presence. Circular chat FAB in the bottom-right; panel expands upward with glass surface matching TRL-75 tokens. Emotional tone: quick coordination, not a full messaging product.

## Layout

| Region | Position | Notes |
|--------|----------|-------|
| FAB | `right/bottom: --float-inset` | 48px circle, `MessageCircle` icon |
| Panel | Above FAB | 300px wide, max 360px tall |
| Debug HUD | Above FAB (+56px) | Stacks vertically; no horizontal clash |

Hidden on viewports `<768px` (matches debug console).

## Components

| Component | States | Codebase |
|-----------|--------|----------|
| `RoomChat` FAB | default, expanded, unread badge | `src/lib/ui/RoomChat.svelte` |
| Chat panel | open/closed, empty thread | same |
| Message row | mine / peer, avatar initials | `peerColor`, `peerInitials` |
| Composer | disabled offline, send disabled when empty | `session.sendChat` |

## Interaction matrix

| Input | Output |
|-------|--------|
| Click FAB | Toggle panel; clear unread on open |
| Escape | Close panel |
| Enter / send btn | Post message (max 280 chars) |
| Remote `chat` wire | Append message; bump unread if closed |

## A11y

- FAB: `aria-expanded`, `aria-controls`, label includes unread count
- Panel: `role="dialog"`, labelled header
- Messages: `aria-live="polite"`
- Composer: labelled input, send button

## Explicit non-goals (v1)

- History replay on join
- Trellis durable tier
- Typing indicators
