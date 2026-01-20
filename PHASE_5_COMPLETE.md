# Phase 5: Containers (Acts & Scenes) - COMPLETE

## Overview
Phase 5 implements the fractal container system for organizing story nodes into Acts and Scenes. Containers provide visual grouping and hierarchical organization of the narrative structure.

## Implemented Features

### 1. Container CRUD Operations (IPC Handlers)
- `container-create`: Create new Act or Scene containers
- `container-list`: Get all containers for a canvas
- `container-get`: Get a single container by ID
- `container-update`: Update container properties
- `container-update-bounds`: Update container position and size
- `container-delete`: Delete a container (nodes are unassigned, not deleted)
- `container-assign-node`: Assign a node to a container
- `container-unassign-node`: Remove a node from a container
- `container-get-nodes`: Get all nodes in a container
- `container-calculate-bounds`: Calculate bounds based on contained nodes

### 2. ContainerNode UI Component
- Visual representation of Acts (amber/orange) and Scenes (green)
- Dashed border styling to distinguish from story nodes
- Resizable via NodeResizer when selected
- Inline rename functionality
- Delete button in header
- Rendered behind story nodes (zIndex: -1)

### 3. Canvas Integration
- Containers load automatically with canvas nodes
- "Container" dropdown menu in header toolbar
- Create Act or Scene with one click
- Containers render as React Flow nodes
- Container handlers for delete, rename, resize

## Database Schema (Already Existed)
The `fractal_containers` table was created in Phase 0:
- `id`: UUID primary key
- `project_id`: Foreign key to projects
- `canvas_id`: Foreign key to canvases
- `parent_id`: Self-referential for nested containers
- `type`: 'ACT' or 'SCENE'
- `name`: Display name
- `x`, `y`, `width`, `height`: Position and size
- `color`: Optional custom color
- `ANCHOR_START_ID`, `ANCHOR_START_DRIFT`: Start anchor (future)
- `ANCHOR_END_ID`, `ANCHOR_END_DRIFT`: End anchor (future)

## Files Modified/Created

### New Files
- `src/renderer/src/components/nodes/ContainerNode.tsx` - Container node component

### Modified Files
- `src/main/ipc/handlers.ts` - Added 10 container IPC handlers
- `src/preload/preload.ts` - Added container bridge methods and types
- `src/shared/types.ts` - Added ContainerNodeData interface
- `src/renderer/src/components/CanvasView.tsx` - Integrated container loading/creation

## Usage

### Creating Containers
1. Click "Container" button in canvas header
2. Choose "Add Act" or "Add Scene"
3. Container appears on canvas

### Managing Containers
- **Rename**: Click edit icon in container header
- **Resize**: Select container, drag corner handles
- **Delete**: Click trash icon in container header

### Container Hierarchy
- Acts are larger containers (800x600 default)
- Scenes are smaller containers (400x300 default)
- Scenes can be nested inside Acts (via parent_id)

## Future Enhancements (Phase 5+)
- Drag nodes into containers to auto-assign
- Container-based scope navigation
- Anchor-based dynamic sizing (ANCHOR_START/END)
- Collapse/expand containers
- Container-specific timeline view

## Testing Checklist
- [ ] Create Act container
- [ ] Create Scene container
- [ ] Rename container
- [ ] Resize container
- [ ] Delete container
- [ ] Verify containers persist after reload
- [ ] Verify containers render behind story nodes

## Next Phase
Phase 6: Timeline View - Linear representation of the story graph for playback and export.
