# GraphFlow Refactor Plan

This document tracks the progress of refactoring the GraphFlow application to improve code cohesion and maintainability.

## Phase 1: Common Components & Dashboard Split (Foundation)
- [x] **Extract `JsonTreeEditor`**: Move generic code editor from `Editor.tsx` to `components/common/`.
- [x] **Extract `CollapsibleSection`**: Move UI wrapper from `Editor.tsx` to `components/common/`.
- [x] **Extract `ProjectCard`**: Move project list item from `Dashboard.tsx` to `components/dashboard/`.
- [x] **Cleanup**: Update `Editor.tsx` and `Dashboard.tsx` to import new components.

## Phase 2: Editor Core Split (Logic Decoupling)
- [x] **Extract `EditorToolbar`**: Separate top navigation and mode toggles.
- [x] **Extract `DevToolsSidebar`**: Separate the right-side developer panel.
- [x] **Extract `DirectorSidebar`**: Separate the complex Director Mode UI (Timeline, StepCards) into its own module.
- [x] **Refactor `Editor.tsx`**: Main file should only handle layout and state distribution.

## Phase 3: GraphCanvas Overlay Split (UI/D3 Separation)
- [x] **Extract `GraphContextMenu`**: Move the node editing popup.
- [x] **Extract `LinkControls`**: Move link deletion UI.
- [x] **Extract `DirectorOverlay`**: Move top-center director prompts.
- [x] **Refactor `GraphCanvas.tsx`**: Focus purely on D3 simulation and rendering.
