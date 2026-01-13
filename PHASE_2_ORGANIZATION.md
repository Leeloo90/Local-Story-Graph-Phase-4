# Phase 2: Organization Systems Implementation Guide

This document outlines the implementation of the Attic and Bucket systems for the "Magnetic Construction" architecture.

## Overview

After Phase 1 (Root Node + Horizontal Spine Linking) is complete, Phase 2 adds the organizational zones that allow users to manage media before committing it to the edit.

---

## 1. The Attic System

### Purpose
The Attic is a "local context" zone - a holding area for media clips associated with a specific Spine (scene) but not yet committed to the timeline.

### Visual Design
- **Position**: Floating 50px above each Spine node
- **Appearance**: Semi-transparent container (rgba(28, 28, 30, 0.5))
- **Layout**: Horizontal auto-arranged row of nodes
- **Gap**: 10px between items

### Data Model
```typescript
// Node in Attic:
{
  id: "uuid",
  attic_parent_id: "spine-uuid", // Which spine's attic this belongs to
  anchor_id: null,                // Not anchored (floating)
  connection_mode: null,
  x: auto-calculated,             // Calculated by layout engine
  y: auto-calculated,
  // ... other fields
}
```

### Interaction Flow

#### 1. Moving Node to Attic
```typescript
// IPC Handler: node-move-to-attic
ipcMain.handle('node-move-to-attic', async (_, nodeId, spineId) => {
  // Remove any existing anchors
  db.execute(`
    UPDATE story_nodes
    SET attic_parent_id = ?,
        anchor_id = NULL,
        connection_mode = NULL
    WHERE id = ?
  `, [spineId, nodeId]);
});
```

#### 2. Dragging Within Attic (Reorder)
```typescript
// Frontend: onAtticItemDrag
function handleAtticReorder(draggedId: string, newIndex: number) {
  // Attic items are auto-arranged, so we just update their order
  // This could be stored as an `attic_order` field, or calculated by creation date
  // For Phase 2, we'll use simple left-to-right order
}
```

#### 3. Dragging Out of Attic (Anchor)
```typescript
// Trigger Anchor Decision Modal
function handleAtticNodeDragToAssembly(nodeId: string, targetZone: DropZone) {
  // User drags from Attic → Main Canvas
  // This triggers the same Anchor Modal as any other connection
  showAnchorModal(nodeId, targetZone.nodeId, targetZone.type);
}
```

### Timeline Representation
- Attic nodes appear on **Track -1** (above V1)
- They show as semi-transparent "preview" clips
- They do NOT affect the final render

---

## 2. The Bucket System

### Purpose
Global storage for raw media assets not yet assigned to any scene. This is the "import bin" equivalent.

### Visual Design
- **Position**: Bottom drawer that slides up
- **Height**: 200px when open, 0px when closed
- **Toggle**: Button in top toolbar ("Show/Hide Bucket")
- **Layout**: Grid (4 columns on 1920px display)
- **Appearance**: Dark panel (bg-surface-high)

### Data Model
```typescript
// Node in Bucket:
{
  id: "uuid",
  attic_parent_id: null,  // Not in any attic
  anchor_id: null,         // Not anchored
  is_global: true,         // Bucket flag (optional, for querying)
  x: 0,                    // Ignored (bucket has own layout)
  y: 0,
  // ... other fields
}
```

### Component Structure
```tsx
// BucketPanel.tsx
interface BucketPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  projectId: string;
}

function BucketPanel({ isOpen, onToggle, projectId }: BucketPanelProps) {
  const [bucketNodes, setBucketNodes] = useState<StoryNode[]>([]);

  useEffect(() => {
    loadBucketNodes();
  }, [projectId]);

  async function loadBucketNodes() {
    // Query nodes with no attic_parent and no anchor
    const nodes = await window.electronAPI.nodeList(canvasId);
    const bucket = nodes.filter(n => !n.attic_parent_id && !n.anchor_id);
    setBucketNodes(bucket);
  }

  return (
    <div className={`
      fixed bottom-0 left-0 right-0
      bg-surface-high border-t-2 border-void-gray
      transition-transform duration-300
      ${isOpen ? 'translate-y-0' : 'translate-y-full'}
    `}>
      <div className="h-[200px] p-4 overflow-auto">
        <div className="grid grid-cols-4 gap-4">
          {bucketNodes.map(node => (
            <BucketItem
              key={node.id}
              node={node}
              onDragStart={() => handleDragStart(node.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Interaction Flow

#### 1. Importing Media → Bucket
```typescript
// When user imports files, they land in the Bucket
async function handleMediaImport(filePaths: string[]) {
  const assets = await window.electronAPI.mediaImport(projectId, filePaths);

  // Create a node for each asset (in Bucket state)
  for (const asset of assets) {
    await window.electronAPI.nodeCreate(canvasId, {
      asset_id: asset.id,
      type: 'SATELLITE',
      subtype: 'VIDEO',
      attic_parent_id: null,
      anchor_id: null,
      x: 0,
      y: 0,
      width: 180,
      height: 60,
    });
  }
}
```

#### 2. Dragging from Bucket → Canvas
```typescript
// onBucketItemDrag
function handleBucketItemDrop(nodeId: string, dropPosition: { x: number; y: number }) {
  // Detect where it was dropped
  const zone = detectDropZone(dropPosition.x, dropPosition.y, dropZones);

  if (zone) {
    // Dropped on a target → Anchor Modal
    showAnchorModal(nodeId, zone.nodeId, zone.type);
  } else {
    // Dropped in void → Smart Void logic
    const destination = handleVoidDrop(dropPosition.x, layoutNodes);

    if (destination === 'bucket') {
      // Stays in bucket (dropped too far from any spine)
      return;
    } else {
      // Move to spine's attic
      await window.electronAPI.nodeMoveToAttic(nodeId, destination);
    }
  }
}
```

#### 3. Moving Node Back to Bucket
```typescript
// IPC Handler: node-move-to-bucket
ipcMain.handle('node-move-to-bucket', async (_, nodeId) => {
  db.execute(`
    UPDATE story_nodes
    SET attic_parent_id = NULL,
        anchor_id = NULL,
        connection_mode = NULL
    WHERE id = ?
  `, [nodeId]);
});
```

---

## 3. Render Logic Integration

### Canvas Rendering
```typescript
// CanvasView.tsx
function renderCanvas() {
  const { nodes, edges } = buildGraphLayout(storyNodes);

  // Separate attic nodes for special rendering
  const assemblyNodes = nodes.filter(n => n.zone === Zone.ASSEMBLY);
  const atticNodes = nodes.filter(n => n.zone === Zone.ATTIC);

  return (
    <ReactFlow nodes={[...assemblyNodes, ...atticNodes]} edges={edges}>
      {/* Attic containers rendered as custom overlays */}
      {assemblyNodes.filter(n => n.data.storyNode.type === 'SPINE').map(spine => (
        <AtticContainer
          key={`attic-${spine.id}`}
          spineId={spine.id}
          items={atticNodes.filter(n => n.data.storyNode.attic_parent_id === spine.id)}
          position={{ x: spine.x, y: spine.y - ATTIC_MARGIN_TOP }}
        />
      ))}
    </ReactFlow>
  );
}
```

### Timeline Rendering
```typescript
// TimelineView.tsx
function buildTimelineTracks(nodes: StoryNode[]) {
  const tracks: Record<number, StoryNode[]> = {};

  // Track -1: Attic nodes (preview)
  tracks[-1] = nodes.filter(n => n.attic_parent_id !== null);

  // Track V1, V2, etc.: Anchored nodes
  // (Same logic as before, but filtered to exclude attic nodes)
  const anchoredNodes = nodes.filter(n => n.anchor_id !== null);
  // ... build tracks from anchor chain

  return tracks;
}
```

---

## 4. Implementation Checklist

### Backend (IPC Handlers)
- [ ] `node-move-to-attic(nodeId, spineId)` - Move node to spine's attic
- [ ] `node-move-to-bucket(nodeId)` - Remove all anchors/attic assignments
- [ ] `node-get-attic-items(spineId)` - Query nodes in a spine's attic
- [ ] `node-get-bucket-items(projectId)` - Query unanchored/unatticed nodes

### Frontend (Components)
- [ ] `BucketPanel.tsx` - Bottom drawer with grid layout
- [ ] `AtticContainer.tsx` - Overlay above spine nodes
- [ ] `AtticItem.tsx` - Draggable item in attic
- [ ] Update `CanvasView.tsx` to render attic containers
- [ ] Update `SpineNode.tsx` to show attic visual indicator

### Frontend (Interaction)
- [ ] Drag from Bucket → Attic (Smart Void logic)
- [ ] Drag from Bucket → Assembly (Anchor Modal)
- [ ] Drag from Attic → Assembly (Anchor Modal)
- [ ] Drag within Attic (Reorder)
- [ ] Drag from Assembly → Bucket (Confirmation modal?)
- [ ] Drag from Assembly → Attic (Break anchor, move to attic)

### Frontend (Visual Feedback)
- [ ] Ghost boxes for drop zones
- [ ] Highlight attic container when dragging near it
- [ ] Dim attic nodes (semi-transparent)
- [ ] Show attic item count badge on spine

---

## 5. Testing Scenarios

### Scenario 1: Import → Organize → Anchor
1. Import 5 video files (they land in Bucket)
2. Drag 3 files from Bucket to area above Spine 1 (they go to Attic)
3. Drag 1 file from Attic to Spine 1's right port (becomes Spine 2)
4. Verify: Bucket has 2 files, Attic 1 has 2 files, Assembly has 2 spines

### Scenario 2: Void Drop
1. Drag file from Bucket to empty space 150px from Spine 1
2. Expected: File goes to Spine 1's Attic (within threshold)
3. Drag file from Bucket to empty space 400px from Spine 1
4. Expected: File stays in Bucket (too far)

### Scenario 3: Attic → Assembly
1. Drag node from Attic 1 to Spine 1's top port
2. Anchor Modal appears
3. Select "Anchor to Start"
4. Node becomes Satellite, leaves Attic, appears stacked on Spine 1

### Scenario 4: Assembly → Bucket (Destructive)
1. Right-click anchored Satellite
2. Context menu: "Move to Bucket"
3. Confirmation: "This will remove the anchor. Continue?"
4. Node moves to Bucket, anchor breaks

---

## 6. Future Enhancements (Post-Phase 2)

- **Attic Search**: Filter attic items by name/type
- **Attic Sorting**: Sort by name, duration, date added
- **Bucket Folders**: Organize bucket by folders/tags
- **Batch Operations**: Select multiple items, move all to attic
- **Preview on Hover**: Scrub video when hovering attic item
- **Bucket Paging**: Pagination if 100+ items in bucket

---

## Notes for Implementation

1. **Attic Layout is Auto-Calculated**: Users cannot manually position attic items. They auto-arrange left-to-right.

2. **Bucket is NOT Part of Canvas**: The Bucket is a separate UI panel. Nodes in the Bucket do not have canvas coordinates.

3. **Track -1 is Special**: The Timeline renders attic nodes on Track -1 for preview purposes, but they are excluded from export.

4. **Smart Void Logic**: The 300px threshold is configurable. Adjust based on user testing.

5. **Attic Item Order**: For MVP, order by creation time. Later, add manual reordering.

6. **Bucket Toggle State**: Store bucket open/closed state in localStorage for persistence across sessions.

---

This completes the Organization Systems design. Implement after Phase 1 (Root + Horizontal Spine) is working.
