# Phase 1: Root Node + Horizontal Spine Implementation Status

## ✅ Completed Work

### 1. Database Schema Updates
**File**: `src/main/database/schema.ts`

Added `attic_parent_id` field to support the three-zone system:
```sql
-- Attic system (Magnetic Construction v2)
-- Nodes in the Attic are "parked" above a Spine, not yet committed to the edit
attic_parent_id TEXT,
```

- ✅ Foreign key constraint added
- ✅ Index created for performance (`idx_node_attic_parent`)
- ✅ Properly documented

### 2. TypeScript Type Definitions
**File**: `src/shared/types.ts`

Updated `StoryNode` interface:
```typescript
// Attic system (Magnetic Construction v2)
// Nodes in the Attic are "parked" above a Spine, not yet committed to the edit
attic_parent_id?: string; // FK to story_nodes (the Spine this node is parked under)
```

- ✅ Type safety maintained
- ✅ Documentation added

### 3. New Topology Engine (V2)
**File**: `src/renderer/src/utils/topology-v2.ts`

Complete rewrite of the layout system based on "Magnetic Construction" principles:

#### Core Features Implemented:
- ✅ **Flat Layout Algorithm**: No more recursive calculations
- ✅ **Zone-Based Rendering**: Assembly, Attic, Bucket zones
- ✅ **Linked List Spine**: Walks left-to-right for sequential spine nodes
- ✅ **Dynamic Width Calculation**: "Breathing" spines expand based on content
- ✅ **Attic Auto-Layout**: Horizontal arrangement with 10px gaps
- ✅ **Vertical Stacking**: Satellites stack on top of parents
- ✅ **Drop Zone System**: Detection for left/right/top/attic zones
- ✅ **Smart Void Logic**: 300px threshold to snap to nearest spine's attic

#### Key Functions:
```typescript
buildGraphLayout(nodes) → { nodes, edges }  // Main entry point
generateDropZones(layoutNodes) → DropZone[]  // For interaction
detectDropZone(x, y, zones) → DropZone | null  // Mouse detection
handleVoidDrop(x, layoutNodes) → spineId | 'bucket'  // Smart void
calculateSpineWidth(spine, allNodes) → number  // Dynamic width
```

### 4. Organization Documentation
**File**: `PHASE_2_ORGANIZATION.md`

Complete implementation guide for Phase 2 (Attic + Bucket systems):
- ✅ Attic system design and interaction flows
- ✅ Bucket panel design and component structure
- ✅ Timeline integration (Track -1 for attic)
- ✅ Testing scenarios
- ✅ Implementation checklist

### 5. Build Verification
- ✅ **TypeScript compilation**: 0 errors
- ✅ **Vite build**: Successful
- ✅ **All imports**: Resolved correctly

---

## 🚧 Remaining Work for Phase 1

### 1. Root Node Creation Logic
**Location**: `src/renderer/src/components/CanvasView.tsx`

Need to implement:
```typescript
async function handleFirstNodeDrop(node: StoryNode, dropPosition: { x, y }) {
  // Check if canvas is empty
  const existingNodes = await window.electronAPI.nodeList(canvasId);
  const hasRoot = existingNodes.some(n => !n.anchor_id && !n.attic_parent_id);

  if (!hasRoot) {
    // This becomes the ROOT
    await window.electronAPI.nodeUpdate(node.id, {
      x: CANVAS_START_X,
      y: CANVAS_CENTER_Y,
      anchor_id: null,
      connection_mode: null,
      attic_parent_id: null,
    });
  } else {
    // Show Anchor Modal or Smart Void logic
    handleSubsequentDrop(node, dropPosition);
  }
}
```

### 2. Horizontal Spine Linking (Left/Right Ports)
**Location**: `src/renderer/src/components/CanvasView.tsx`

Need to implement:
```typescript
async function handleHorizontalLink(childId: string, parentId: string, port: 'left' | 'right') {
  // Validate: Only one right neighbor allowed (linked list constraint)
  const validation = await window.electronAPI.nodeValidateAnchor(
    childId,
    parentId,
    port === 'right' ? 'APPEND' : 'PREPEND'
  );

  if (!validation.valid) {
    alert(validation.reason);
    return;
  }

  // Create the link with drift = 0 (snap to neighbor)
  await window.electronAPI.nodeLink(childId, parentId, 'APPEND');

  // Refresh canvas
  await loadCanvasNodes();
}
```

### 3. Update CanvasView to Use Topology V2
**Current**: Using old `topology.ts` with recursive calculation
**Need**: Switch to `topology-v2.ts` flat layout

```typescript
// Replace:
import { computeAbsolutePositions, getAnchorEdges } from '../utils/topology';

// With:
import { buildGraphLayout, generateDropZones, detectDropZone } from '../utils/topology-v2';

// In loadCanvasNodes():
const { nodes: layoutNodes, edges } = buildGraphLayout(storyNodes);
setNodes(layoutNodes);
setEdges(edges);
```

### 4. Disable React Flow Connection Dragging
**Current**: Users can drag wires between handles
**Need**: Disable wire dragging, use drop zones only

```typescript
// In ReactFlow props:
<ReactFlow
  nodes={nodes}
  edges={edges}
  connectionMode="strict"  // Prevent loose connections
  onConnect={() => {}}     // Disable default connection handler
  isValidConnection={() => false}  // Block all wire dragging
  // ... other props
/>
```

### 5. Linked List Validation
**Location**: `src/main/services/topology.ts`

Update validation to enforce linked list constraint:
```typescript
export function validateHorizontalLink(
  childId: string,
  parentId: string,
  port: 'left' | 'right',
  allNodes: Map<string, StoryNode>
): { valid: boolean; reason?: string } {
  if (port === 'right') {
    // Check if parent already has a right neighbor
    const existingRight = Array.from(allNodes.values()).find(n =>
      n.anchor_id === parentId &&
      n.connection_mode === 'APPEND' &&
      n.type === 'SPINE'
    );

    if (existingRight) {
      return {
        valid: false,
        reason: 'This spine already has a right neighbor (linked list constraint)'
      };
    }
  }

  // ... other validations

  return { valid: true };
}
```

---

## 📋 Implementation Checklist

### Backend
- [x] Database schema with `attic_parent_id`
- [ ] Update `node-link` handler to enforce linked list constraint
- [ ] Add `validateHorizontalLink` to topology service
- [ ] Test database migration (delete old DB to force schema recreation)

### Frontend
- [x] Create `topology-v2.ts` with flat layout engine
- [ ] Update `CanvasView.tsx` to use topology v2
- [ ] Implement root node creation logic
- [ ] Implement horizontal spine linking
- [ ] Disable React Flow wire dragging
- [ ] Add drop zone visual feedback (ghost boxes)
- [ ] Update `SpineNode.tsx` to show left/right port indicators

### Testing
- [ ] Create first node → Verify it becomes ROOT at (100, 400)
- [ ] Create second node → Drag to right of first → Becomes Spine 2
- [ ] Try to create third node on first's right → Should fail (already has neighbor)
- [ ] Verify edges render correctly (step type, #2C2C2E color)
- [ ] Verify dynamic width works (add satellites, spine expands)

---

## 🎯 Next Steps

1. **Update CanvasView.tsx** to integrate topology-v2
2. **Implement root node logic** with first-drop detection
3. **Add horizontal linking** with validation
4. **Test the linked list** behavior thoroughly
5. **Once working**, proceed to Phase 2 (Attic + Bucket)

---

## 📐 Architecture Decisions Locked In

### ✅ Confirmed Choices
1. **Keep React Flow** for rendering (just disable connection dragging)
2. **Option A**: Separate `attic_parent_id` field (not overloading `anchor_id`)
3. **Option A**: Bottom drawer for Bucket (slides up)
4. **Path A**: Root + Horizontal first, then Organization

### ✅ Key Constraints
1. **Horizontal Spine = Linked List**: One left neighbor, one right neighbor max
2. **Vertical Stack = Tree**: Unlimited top/bottom children
3. **First Node = ROOT Exception**: No anchor, positioned at fixed coords
4. **Drop Zones Only**: No free wire dragging
5. **Smart Void**: 300px threshold to snap to attic vs. bucket

---

## 🔧 Current System State

### What Works
- ✅ Database schema ready
- ✅ Type definitions updated
- ✅ Topology v2 engine ready
- ✅ Build compiles with 0 errors
- ✅ Phase 2 documentation complete

### What Needs Work
- ⚠️ CanvasView still using old topology
- ⚠️ No root node creation logic yet
- ⚠️ No horizontal linking implementation yet
- ⚠️ React Flow wire dragging still enabled
- ⚠️ No drop zone visual feedback yet

---

## 📊 Estimated Remaining Effort

| Task | Complexity | Time |
|------|------------|------|
| Switch to topology-v2 | Low | 30 min |
| Root node logic | Medium | 1 hour |
| Horizontal linking | Medium | 2 hours |
| Disable wire dragging | Low | 30 min |
| Drop zone feedback | Medium | 2 hours |
| Testing & debugging | High | 3 hours |
| **Total** | | **~9 hours** |

---

This positions us perfectly to complete Phase 1 and move to Phase 2 (Organization systems).
