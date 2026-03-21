# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server (Vite)
npm run build     # Production build
npm run preview   # Preview production build
```

There is no test framework configured.

## Architecture Overview

**GraphFlow** is a React + TypeScript SPA for creating and animating node graphs (network diagrams). It uses D3 for force-directed layout and graph rendering, GSAP for packet/node animations, and CodeMirror for JSON editing.

### Top-level data flow

`App.tsx` owns the `GraphProject[]` array, persisted to `localStorage` (`graphflow_projects`). It renders either `Dashboard` (project list) or `Editor` (single project). The `Editor` receives an `initialProject` and calls `onSave` with the updated project on manual save.

### Core data model (`types.ts`)

- **`GraphProject`** — top-level saved unit: `graphData`, `themeData`, `eventData`
- **`GraphData`** — `nodes`, `links`, and optional `environments` (zones + labels)
- **`ThemeConfig`** — named `nodeStyles` and `linkStyles`, each with `persistent` visuals and `animation` props
- **`EventSequence`** — `initNodes` (pre-simulation node states) + `steps` array of `AtomicStep | ParallelStep`
- **`AtomicStep`** — a directed flow from node→node with optional `linkStyle`, `targetNodeState`, `processingNodeState`, `finalNodeState`, and timing overrides
- **`ParallelStep`** — wraps multiple `SimulationAction`s that fire concurrently

### Editor modes

The `Editor` component manages three mutually exclusive overlay modes:
- **Link Mode** (`isLinkMode`) — click two nodes to create a link
- **Dev Mode** (`devMode`) — opens `DevToolsSidebar` with raw JSON editors for graph/theme/event data
- **Director Mode** (`isDirectorMode`) — opens `DirectorSidebar` for visual animation authoring; graph state is snapshotted on enter and restored on exit

### GraphCanvas + simulation (`GraphCanvas.tsx`, `hooks/useGraphSimulation.ts`)

`GraphCanvas` is a `forwardRef` component exposing `GraphCanvasHandle`:
- `runAnimation(sequence)` — plays a full `EventSequence`
- `runSingleStep(step)` — plays one step (used by Director Mode for live preview)

All D3 force-simulation logic, SVG rendering, drag/zoom, and interaction events live in `useGraphSimulation`. Animation packets and node state transitions are handled in `utils/graphAnimations.ts` (GSAP) and style updates in `utils/graphStyling.ts` (D3 selections).

### Component tree

```
App
├── Dashboard
│   └── ProjectCard
└── Editor
    ├── EditorToolbar
    ├── GraphCanvas
    │   ├── GraphControls
    │   ├── GraphContextMenu
    │   ├── EnvironmentContextMenu
    │   ├── LinkControls
    │   ├── DirectorOverlay
    │   └── Minimap (rendered via renderMinimap prop)
    ├── DevToolsSidebar
    └── DirectorSidebar
        └── DirectorStepCard
```

### Internationalisation

`i18n.tsx` provides a custom `I18nProvider` / `useTranslation` hook supporting `en` and `zh`, auto-detected from `navigator.language`. All UI strings should use translation keys rather than hardcoded strings.

### Environment zones

`EnvironmentZone` objects support a locking mechanism: when `isLocked` is set, the zone captures all nodes/labels/child-zones within its bounds into `attachedElementIds`, so they move together. Locking/unlocking logic is handled in `Editor.tsx`:`handleZoneUpdate`.
