# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StitchCraft is a React-based image stitching tool for manual alignment of multiple images with precise coordinate export. The app implements OpenCV-compatible `cv2.warpAffine` coordinate logic to ensure exported data can be used directly with Python image processing pipelines.

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Start dev server (runs on port 3000, not 5173 as README states)
npm run dev

# Type checking
npx tsc --noEmit

# Build for production
npm run build

# Preview production build
npm run preview
```

### Docker Workflow
```bash
# Development mode
make build          # Build dev Docker image
make run            # Run dev container (port 5173 → 3000)
make logs           # View container logs
make shell          # Access container shell
make stop           # Stop container

# Production mode
make build-prod     # Build production image
make run-prod       # Run production container (port 80)

# Utilities
make clean          # Remove containers and images
make rebuild        # Clean, rebuild, and run
make test           # Run type check
```

## Architecture and Key Patterns

### Single-File React Application

The entire UI is implemented in `App.tsx` (1,538 lines). There are no separate page components, routing, or complex state management libraries. All state is managed via React hooks.

### Core Data Model

The `Layer` interface (types.ts) represents an image layer:
- `x`, `y`: Top-left corner of the **rotated bounding box**, not the original image
- `rotation`: Degrees of rotation around image center
- `scale`: Scale multiplier applied before rotation
- `width`, `height`: Original image dimensions (intrinsic)

**Critical**: The coordinate system matches OpenCV's `cv2.warpAffine` behavior. When an image is rotated, its bounding box expands. The `x, y` position refers to the top-left of this expanded bounding box.

### Coordinate System Logic

The `calculateRotatedDimensions()` function (App.tsx:12-43) is central to the entire application:

```typescript
// Calculates the axis-aligned bounding box dimensions after rotation
// Uses the exact formula OpenCV uses internally:
// new_w = (h * sin) + (w * cos)
// new_h = (h * cos) + (w * sin)
```

When updating `rotation` or `scale` in `updateSelectedLayers()`, the bounding box size changes. To keep the image visually centered at the same spot, the top-left `(x, y)` must be recalculated (App.tsx:429-459).

### State Management

All state lives in `App.tsx`:
- `layers`: Array of Layer objects (order determines z-index)
- `selectedLayerIds`: Set of selected layer IDs (supports multi-select)
- `checkedLayers`: Set of checked layer IDs (for export filtering)
- `history` / `future`: Undo/redo stacks (max 50 history items)
- `zoom`, `pan`: Canvas viewport transform
- `isDraggingCanvas`, `isDraggingLayer`, `isSelecting`: Interaction states

### Interaction Model

Three distinct mouse interaction modes:
1. **Canvas Pan**: Space key, middle-click, or Cmd/Ctrl + drag on empty space
2. **Layer Drag**: Click and drag on layer (supports multi-select with Shift/Ctrl)
3. **Box Selection**: Click and drag on empty space without modifiers

The `handleMouseDown()`, `handleMouseMove()`, and `handleMouseUp()` functions coordinate these modes (App.tsx:634-774).

### History System

Before any state-modifying operation, `addToHistory()` is called to save the current `layers` state. The history is capped at 50 entries. Undo/redo uses Ctrl+Z and Ctrl+Shift+Z / Ctrl+Y.

### Export Format

Export generates either JSON or CSV with this schema:
- `filename`: Layer name (original image filename)
- `shift_x`: Rounded `x` coordinate
- `shift_y`: Rounded `y` coordinate
- `rotate`: Rotation in degrees (rounded to 2 decimals)
- `layer_order`: 0-indexed position

If layers are checked, only checked layers are exported; otherwise all layers are exported.

## Component Structure

### Inline Components (App.tsx)

- `Button`: Frosted glass styled button with variants (primary, secondary, danger, ghost)
- `InputGroup`: Label + input wrapper
- `NumberInput`: Custom number input with local state to handle intermediate typing (e.g., "-", "0.")
- `ExportModal`: Modal for previewing and downloading export data
- `InfoModal`: Help modal explaining coordinate system

### Icon Wrapper (components/Icon.tsx)

Simple re-export wrapper around `lucide-react` icons for centralized imports.

## Build Configuration

### Vite (vite.config.ts)

- Dev server runs on port **3000** (not 5173)
- Host set to `0.0.0.0` for Docker compatibility
- Defines `process.env.GEMINI_API_KEY` (appears unused in current code)
- Path alias: `@/` → project root

### Docker Multi-Stage Build

Three build targets in `Dockerfile`:
1. `builder`: Builds production assets
2. `production`: Nginx serving static files (port 80)
3. `development`: Vite dev server with hot reload (port 3000, exposed as 5173)

### TypeScript (tsconfig.json)

- Target: ES2022
- JSX: `react-jsx` (new JSX transform)
- Module resolution: `bundler` (Vite-compatible)
- `noEmit: true` (type checking only, no output)

## Styling Approach

Uses Tailwind CSS utility classes with a "frosted glass" design system:
- Backgrounds: `bg-white/60` with `backdrop-blur-2xl`
- Borders: `border-white/50` with `ring-1 ring-white/40`
- Shadows: `shadow-2xl` with color-specific shadow variations
- Rounded corners: `rounded-[2rem]` for panels, `rounded-xl` for buttons

Main background uses a full-screen image with overlay (`bg-slate-50/70 backdrop-blur-[4px]`).

## Canvas Rendering

The canvas uses CSS transforms for zoom/pan rather than a `<canvas>` element. Images are absolutely positioned `<img>` elements within a transformed container (App.tsx:1207-1322).

**Transform hierarchy**:
1. Outer container: Apply `zoom` and `pan` (App.tsx:1208-1216)
2. Layer container: Position at bounding box `(x, y)` with bounding box dimensions
3. Inner `<img>`: Centered within bounding box, rotated via CSS `transform: rotate()`

This keeps the math clean and allows CSS to handle the actual rotation.

## Known Quirks

1. **README inconsistency**: README says dev server runs on port 5173, but vite.config.ts sets port 3000
2. **Unused environment variables**: GEMINI_API_KEY is defined but never used in the code
3. **No test suite**: No test files or test runner configured
4. **Layer reordering via drag-and-drop**: Uses HTML5 drag API, not canvas-based dragging
5. **Selection box calculations**: Intersection test uses axis-aligned bounding box, not precise rotated polygon intersection

## Development Workflows

### Adding a new control property

1. Update `Layer` interface in `types.ts`
2. Add default value in `handleFileUpload()` (App.tsx:377-416)
3. Add input field in properties panel (App.tsx:1398-1523)
4. Implement update logic in `updateSelectedLayers()` if special handling needed
5. Consider whether to include in `ExportData` schema

### Modifying coordinate calculations

All coordinate math must match OpenCV behavior. The reference implementation is in `calculateRotatedDimensions()`. When changing rotation or scale logic, ensure the bounding box size calculation remains consistent with:

```python
# OpenCV reference:
new_w = abs(h * sin(θ)) + abs(w * cos(θ))
new_h = abs(h * cos(θ)) + abs(w * sin(θ))
```

### Adding keyboard shortcuts

Shortcuts are handled in the `useEffect` keyboard listener (App.tsx:786-845). Add new cases to the `switch` statement, ensuring they don't fire when typing in inputs.
